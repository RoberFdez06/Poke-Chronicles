// Números con coma decimal, como se escriben en español. Lógica pura.

/** `decimal(18.1)` → «18,1»; con `digits` fija los decimales: `decimal(0.9, 2)` → «0,90». */
export function decimal(n: number, digits?: number): string {
  return (digits === undefined ? String(n) : n.toFixed(digits)).replace('.', ',');
}
