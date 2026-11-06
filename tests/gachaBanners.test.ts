// gachareg: banners del gacha por región y por formas regionales. Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GACHA_RATES, RARITIES, classifyRarity, type Rarity, type SpeciesFact } from '../src/data/gacha.ts';
import {
  ALL_BANNER, BANNERS, BANNERS_KEY, FORMS_BANNER, PITY, advancePity, bannerById, bannerProgress, bannerTop, buildBannerPools,
  effectiveRates, featuredOf, formsProgress, loadBannerState, parseBannerState, pityLeft, pityOf, poolIds, pullBanner,
  rememberBanner, saveBannerState,
} from '../src/data/gachaBanners.ts';
import { parseHistory } from '../src/data/gachaHistory.ts';
import { REGIONAL_FORMS, isRegionalForm, regionalForm, withRegionalForms } from '../src/data/regionalForms.ts';
import { REGIONS, regionOf } from '../src/data/regions.ts';
import { MemoryStorage } from '../src/data/storage.ts';
import { BANNER_COLORS, BANNER_EMBLEMS } from '../src/ui/art/bannerEmblems.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const base = JSON.parse(readFileSync(new URL('../public/data/species-index.json', import.meta.url), 'utf8')) as SpeciesFact[];
const index = withRegionalForms(base);
const pools = buildBannerPools(index);
const rank = (r: Rarity) => RARITIES.indexOf(r);

test('hay un banner Todas, uno por cada región de regions.ts y Formas regionales', () => {
  assert.equal(BANNERS[0].id, ALL_BANNER);
  assert.equal(BANNERS.at(-1)!.id, FORMS_BANNER);
  assert.deepEqual(BANNERS.filter((b) => b.kind === 'region').map((b) => b.id), REGIONS.map((r) => r.id));
  assert.equal(new Set(BANNERS.map((b) => b.id)).size, BANNERS.length);
});

test('los banners de región no se solapan y, con Formas, cubren justo Todas', () => {
  const seen = new Map<number, string>();
  for (const b of BANNERS.filter((x) => x.kind !== 'all')) {
    for (const id of poolIds(pools[b.id])) {
      assert.ok(!seen.has(id), `#${id} en ${b.id} y ${seen.get(id)}`);
      seen.set(id, b.id);
    }
  }
  const all = poolIds(pools[ALL_BANNER]);
  assert.equal(seen.size, all.length);
  assert.equal(all.length, 1025 + REGIONAL_FORMS.length);
  for (const id of all) assert.ok(seen.has(id), `#${id} sin banner`);
});

test('cada especie está en el banner de su región y las formas solo en Formas regionales', () => {
  for (const b of BANNERS.filter((x) => x.kind === 'region')) {
    for (const id of poolIds(pools[b.id])) {
      assert.ok(!isRegionalForm(id));
      assert.equal(regionOf(id)?.id, b.id, `#${id}`);
      assert.ok(id >= b.first! && id <= b.last!);
    }
  }
  const forms = poolIds(pools[FORMS_BANNER]);
  assert.equal(forms.length, REGIONAL_FORMS.length);
  for (const id of forms) assert.ok(isRegionalForm(id));
  assert.equal(poolIds(pools.kanto).length, 151);
  assert.equal(poolIds(pools.paldea).length, 120);
  // Mewtwo en Kanto, Vulpix de Alola en Formas y Growlithe de Hisui también
  assert.ok(pools.kanto.legendary.includes(150));
  assert.ok(poolIds(pools[FORMS_BANNER]).includes(10103));
  assert.ok(poolIds(pools[FORMS_BANNER]).includes(10229));
});

test('se mantienen las rarezas: cada Pokémon tiene en su banner la misma rareza que en Todas', () => {
  const rarityAll = new Map<number, Rarity>();
  for (const r of RARITIES) for (const id of pools[ALL_BANNER][r]) rarityAll.set(id, r);
  for (const b of BANNERS) for (const r of RARITIES) for (const id of pools[b.id][r]) assert.equal(rarityAll.get(id), r);
  const s = index.find((x) => x.id === 10242)!; // Goodra de Hisui (600)
  assert.equal(classifyRarity(s), 'epic');
  assert.deepEqual(pools.alola.ultra.length, 11); // los Ultraentes son de Alola
  assert.equal(pools.kanto.ultra.length, 0);
});

test('probabilidades: suman 100 en todos los banners y las vacías pasan a la rareza más cercana', () => {
  for (const b of BANNERS) {
    const er = effectiveRates(pools[b.id]);
    assert.equal(RARITIES.reduce((n, r) => n + er[r], 0), 100, b.id);
    for (const r of RARITIES) if (pools[b.id][r].length === 0) assert.equal(er[r], 0);
  }
  assert.deepEqual(effectiveRates(pools[ALL_BANNER]), { ...GACHA_RATES });
  assert.deepEqual(effectiveRates(pools.alola), { ...GACHA_RATES });
  // Kanto no tiene Ultraentes: su 4 % pasa a Épico (a igual distancia, la menos valiosa)
  assert.deepEqual(effectiveRates(pools.kanto), { common: 60, rare: 25, epic: 14, ultra: 0, legendary: 1 });
  // Formas regionales no tiene ni Ultraentes ni legendarios
  assert.equal(bannerTop(pools[FORMS_BANNER]), 'epic');
  assert.equal(effectiveRates(pools[FORMS_BANNER]).epic, 15);
});

test('las tiradas reales siguen las probabilidades del banner y no se salen de él', () => {
  const rng = mulberry32(7);
  const n = 20000;
  const got: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, ultra: 0, legendary: 0 };
  const kanto = new Set(poolIds(pools.kanto));
  let pity = { epic: 0, top: 0 };
  for (let i = 0; i < n; i++) {
    // Sin la garantía (cuenta a cero) para medir la probabilidad pura
    const { results } = pullBanner(rng, pools.kanto, new Set(), pity, 1);
    pity = { epic: 0, top: 0 };
    got[results[0].rarity]++;
    assert.ok(kanto.has(results[0].speciesId));
  }
  const er = effectiveRates(pools.kanto);
  for (const r of RARITIES) assert.ok(Math.abs((got[r] / n) * 100 - er[r]) < 1.2, `${r}: ${got[r]}`);
});

test('garantía por banner: Épico cada 10 y Legendario a las 80 como mucho', () => {
  // Un rng que siempre da la tirada más baja (Común)
  const low = () => 0;
  let pity = { epic: 0, top: 0 };
  const out: Rarity[] = [];
  for (let i = 0; i < PITY.top; i++) {
    const r = pullBanner(low, pools.johto, new Set(), pity, 1);
    pity = r.pity;
    out.push(r.results[0].rarity);
  }
  // A la 10.ª, 20.ª… sale Épico o mejor; a la 80.ª, Legendario
  for (let i = 0; i < out.length; i++) {
    if ((i + 1) % PITY.epic === 0) assert.ok(rank(out[i]) >= rank('epic'), `tirada ${i + 1}: ${out[i]}`);
    else assert.equal(out[i], 'common');
  }
  assert.equal(out.at(-1), 'legendary');
  assert.deepEqual(pity, { epic: 0, top: 0 });
  // Cada banner lleva su cuenta
  const s = parseBannerState(JSON.stringify({ last: 'johto', banners: { johto: { epic: 9, top: 79 } } }));
  assert.deepEqual(pityOf(s, 'johto'), { epic: 9, top: 79 });
  assert.deepEqual(pityOf(s, 'kanto'), { epic: 0, top: 0 });
  assert.deepEqual(pityLeft(pityOf(s, 'johto'), 'legendary'), { epic: 1, top: 1 });
  assert.equal(pityLeft({ epic: 3, top: 0 }, 'epic').top, null);
  assert.equal(pullBanner(low, pools.johto, new Set(), pityOf(s, 'johto'), 1).results[0].rarity, 'legendary');
  assert.deepEqual(advancePity({ epic: 4, top: 30 }, 'epic', 'legendary'), { epic: 0, top: 31 });
});

test('x10 de banner: Épico o mejor asegurado y repetidos dentro de la tanda', () => {
  const low = () => 0;
  const { results, pity } = pullBanner(low, pools.hoenn, new Set(), { epic: 0, top: 0 }, 10);
  assert.equal(results.length, 10);
  assert.ok(results.some((r) => rank(r.rarity) >= rank('epic')));
  assert.equal(pity.epic, 0);
  assert.ok(results.slice(1, 9).every((r) => r.duplicate), 'con rng 0 sale siempre el mismo común');
  // Formas regionales: sin legendario, la garantía máxima es Épico
  const f = pullBanner(mulberry32(3), pools[FORMS_BANNER], new Set(), { epic: 0, top: 0 }, 10);
  assert.ok(f.results.every((r) => isRegionalForm(r.speciesId)));
  assert.equal(f.pity.top, 0);
});

test('progreso X/Y por banner cuenta lo desbloqueado de antes, y Formas por región', () => {
  const owned = [1, 4, 7, 150, 152, 10103, 10229, 10253];
  assert.deepEqual(bannerProgress(pools.kanto, owned), { got: 4, total: 151 });
  assert.deepEqual(bannerProgress(pools.johto, owned), { got: 1, total: 100 });
  assert.equal(bannerProgress(pools[ALL_BANNER], owned).got, owned.length);
  const fp = formsProgress(pools[FORMS_BANNER], owned);
  assert.deepEqual(fp.alola, { got: 1, total: 18 });
  assert.deepEqual(fp.galar, { got: 0, total: 16 });
  assert.deepEqual(fp.hisui, { got: 1, total: 16 });
  assert.deepEqual(fp.paldea, { got: 1, total: 4 });
});

test('las formas de Hisui cuentan en Sinnoh en el Pokédex y no salen como enemigos', () => {
  assert.equal(regionOf(10229)?.id, 'sinnoh');
  assert.equal(regionOf(10253)?.id, 'paldea');
  assert.equal(regionalForm(10250)?.nameEs, 'Tauros de Paldea (Raza Combatiente)');
});

test('destacado del día: de la mejor rareza del banner y estable en el día', () => {
  for (const b of BANNERS) {
    const id = featuredOf(pools[b.id], 20000, b.id);
    assert.ok(id !== null && pools[b.id][bannerTop(pools[b.id])].includes(id), b.id);
    assert.equal(featuredOf(pools[b.id], 20000, b.id), id);
  }
});

test('guardados antiguos: sin estado de banners empieza de cero en Todas; el historial viejo sigue valiendo', () => {
  const st = new MemoryStorage({ 'pokeisaac.unlocked': JSON.stringify({ v: 2, ids: [1, 4, 7] }) });
  const s = loadBannerState(st);
  assert.equal(s.last, ALL_BANNER);
  assert.deepEqual(s.banners, {});
  assert.equal(st.getItem('pokeisaac.unlocked'), JSON.stringify({ v: 2, ids: [1, 4, 7] }), 'no toca lo desbloqueado');
  // Basura y banners que no existen se ignoran; las cuentas se recortan
  const bad = parseBannerState(JSON.stringify({ last: 'unova', banners: { kanto: { epic: -3, top: 999 }, nada: { epic: 1 } } }));
  assert.equal(bad.last, ALL_BANNER);
  assert.deepEqual(bad.banners, { kanto: { epic: 0, top: PITY.top - 1 } });
  assert.deepEqual(parseBannerState('{roto').banners, {});
  // Se guarda y se recuerda el último banner
  s.banners.kalos = { epic: 2, top: 5 };
  saveBannerState(s, st);
  rememberBanner('kalos', st);
  const again = loadBannerState(st);
  assert.equal(again.last, 'kalos');
  assert.deepEqual(again.banners.kalos, { epic: 2, top: 5 });
  assert.ok(st.getItem(BANNERS_KEY));
  // Historial: entradas sin banner (de antes) y con banner
  const h = parseHistory(JSON.stringify([
    { id: 25, rarity: 'common', shiny: false, at: 1 },
    { id: 150, rarity: 'legendary', shiny: true, at: 2, banner: 'kanto' },
    { id: 1, rarity: 'common', shiny: false, at: 3, banner: 7 },
  ]));
  assert.deepEqual(h.map((e) => e.id), [25, 150]);
});

test('cada banner tiene su emblema pixel art 16×16 y su color', () => {
  for (const b of BANNERS) {
    const icon = BANNER_EMBLEMS[b.id];
    assert.ok(icon, b.id);
    assert.ok(bannerById(b.id));
    assert.ok(BANNER_COLORS[b.id] !== undefined, b.id);
    assert.equal(icon.rows.length, 16, b.id);
    for (const row of icon.rows) {
      assert.equal(row.length, 16, `${b.id}: ${row}`);
      for (const c of row) assert.ok(c === '.' || c in icon.palette, `${b.id}: color ${c}`);
    }
  }
});
