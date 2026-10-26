// T71: árbol de mejoras. Cada mejora (upgrades.ts) es un nodo de una de las cuatro ramas; un nodo se puede comprar cuando
// su padre tiene al menos un nivel. Los nodos finales son caros: objetivos a largo plazo. Lógica pura, sin Phaser.
import { UPGRADE_MAX, upgradeCost, type UpgradeKind, type UpgradeLevels } from './upgrades.ts';

export const BRANCHES = ['attack', 'defense', 'loot', 'utility'] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_LABEL: Record<Branch, string> = {
  attack: 'Ataque',
  defense: 'Defensa',
  loot: 'Botín',
  utility: 'Utilidad',
};

export interface TreeNode {
  kind: UpgradeKind;
  branch: Branch;
  /** Fila dentro de la rama (0 = raíz). Sirve para dibujar y para navegar con flechas. */
  depth: number;
  /** Nodo que hay que tener al menos a nivel 1 para poder comprar este (null = raíz). */
  parent: UpgradeKind | null;
  /** Nodo final de la rama (caro). */
  final: boolean;
}

// Las raíces son mejoras que ya existían (damage, hp, speed) para que nadie note un muro al entrar al árbol.
export const UPGRADE_TREE: readonly TreeNode[] = [
  { kind: 'damage', branch: 'attack', depth: 0, parent: null, final: false },
  { kind: 'rate', branch: 'attack', depth: 1, parent: 'damage', final: false },
  { kind: 'crit', branch: 'attack', depth: 2, parent: 'rate', final: false },
  { kind: 'critPower', branch: 'attack', depth: 3, parent: 'crit', final: true },
  { kind: 'hp', branch: 'defense', depth: 0, parent: null, final: false },
  { kind: 'armor', branch: 'defense', depth: 1, parent: 'hp', final: false },
  { kind: 'regen', branch: 'defense', depth: 2, parent: 'armor', final: false },
  { kind: 'bulwark', branch: 'defense', depth: 3, parent: 'regen', final: true },
  { kind: 'magnet', branch: 'loot', depth: 0, parent: null, final: false },
  { kind: 'coins', branch: 'loot', depth: 1, parent: 'magnet', final: false },
  { kind: 'fortune', branch: 'loot', depth: 2, parent: 'coins', final: true },
  { kind: 'speed', branch: 'utility', depth: 0, parent: null, final: false },
  { kind: 'range', branch: 'utility', depth: 1, parent: 'speed', final: false },
  { kind: 'dodge', branch: 'utility', depth: 2, parent: 'range', final: true },
];

export const treeNode = (kind: UpgradeKind): TreeNode => UPGRADE_TREE.find((n) => n.kind === kind)!;

export type NodeState = 'locked' | 'available' | 'max';

/**
 * Estado de un nodo. Lo ya comprado nunca se bloquea: si un guardado viejo tiene, por ejemplo, Crítico sin Cadencia,
 * Crítico sigue aplicándose y se puede seguir subiendo (no se le quita nada a nadie por la migración).
 */
export function nodeState(kind: UpgradeKind, lv: Readonly<UpgradeLevels>): NodeState {
  const have = lv[kind] ?? 0;
  if (have >= UPGRADE_MAX[kind]) return 'max';
  if (have > 0) return 'available';
  const parent = treeNode(kind).parent;
  return parent === null || (lv[parent] ?? 0) > 0 ? 'available' : 'locked';
}

/** Lo que cuesta el siguiente nivel, o null si está al máximo. */
export const nodeCost = (kind: UpgradeKind, lv: Readonly<UpgradeLevels>) => upgradeCost(lv[kind] ?? 0, kind);

/** Caramelos que faltan para completar todo el árbol desde estos niveles (para el «objetivo» de la pantalla). */
export function remainingTreeCost(lv: Readonly<UpgradeLevels>): number {
  let total = 0;
  for (const n of UPGRADE_TREE) for (let l = lv[n.kind] ?? 0; l < UPGRADE_MAX[n.kind]; l++) total += upgradeCost(l, n.kind) ?? 0;
  return total;
}

/** Nodo de la rama `branch` en la fila `depth` (o el más profundo de la rama si no hay tanta). */
export function nodeAt(branch: number, depth: number): TreeNode {
  const b = BRANCHES[(branch + BRANCHES.length) % BRANCHES.length];
  const list = UPGRADE_TREE.filter((n) => n.branch === b);
  return list[Math.max(0, Math.min(list.length - 1, depth))];
}

/** Moverse con flechas por el árbol: izquierda/derecha cambian de rama (conservando la fila), arriba/abajo de nodo. */
export function moveInTree(kind: UpgradeKind, dx: number, dy: number): UpgradeKind {
  const n = treeNode(kind);
  const b = BRANCHES.indexOf(n.branch);
  return nodeAt(b + Math.sign(dx), n.depth + Math.sign(dy)).kind;
}
