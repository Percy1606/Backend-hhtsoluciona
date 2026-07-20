/**
 * Utilidad para cálculos monetarios de alta precisión (Soles PEN / USD).
 * Elimina los errores de coma flotante en JavaScript (ej. 0.1 + 0.2 = 0.30000000000000004)
 * trabajando internamente con céntimos en enteros y redondeos exactos a 2 decimales.
 * Soporta números (number), cadenas (string) y objetos Decimal de Prisma.
 */

export type MoneyInput = number | string | { toNumber?: () => number } | null | undefined;

function toNum(val: MoneyInput): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    return val.toNumber();
  }
  const parsed = Number(val);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

/**
 * Redondea un monto a exactamente 2 decimales (céntimos).
 */
export function roundMoney(amount: MoneyInput): number {
  const num = toNum(amount);
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Suma dos o más montos monetarios con precisión exacta en céntimos.
 */
export function addMoney(...amounts: MoneyInput[]): number {
  const sumInCents = amounts.reduce<number>((acc, val) => {
    const num = toNum(val);
    return acc + Math.round((num + Number.EPSILON) * 100);
  }, 0);
  return sumInCents / 100;
}

/**
 * Resta dos montos (a - b) con precisión exacta en céntimos.
 */
export function subMoney(a: MoneyInput, b: MoneyInput): number {
  const centsA = Math.round((toNum(a) + Number.EPSILON) * 100);
  const centsB = Math.round((toNum(b) + Number.EPSILON) * 100);
  return (centsA - centsB) / 100;
}

/**
 * Multiplica un monto por un factor o porcentaje con redondeo a 2 decimales.
 */
export function mulMoney(amount: MoneyInput, factor: MoneyInput): number {
  const numAmount = toNum(amount);
  const numFactor = toNum(factor);
  return Math.round((numAmount * numFactor + Number.EPSILON) * 100) / 100;
}

/**
 * Divide un monto entre un divisor con redondeo a 2 decimales.
 */
export function divMoney(amount: MoneyInput, divisor: MoneyInput): number {
  const numAmount = toNum(amount);
  const numDivisor = toNum(divisor);
  if (numDivisor === 0) return 0;
  return Math.round((numAmount / numDivisor + Number.EPSILON) * 100) / 100;
}

/**
 * Suma un arreglo de objetos extrayendo la propiedad monetaria de forma segura en céntimos.
 */
export function sumMoneyBy<T>(
  items: T[] | null | undefined,
  getter: (item: T) => MoneyInput,
): number {
  if (!items || !Array.isArray(items)) return 0;
  const sumInCents = items.reduce<number>((acc, item: T) => {
    const num = toNum(getter(item));
    return acc + Math.round((num + Number.EPSILON) * 100);
  }, 0);
  return sumInCents / 100;
}
