/**
 * Проверка ИИН (Казахстан): 12 цифр + контрольный разряд.
 * Алгоритм: веса 1..11, сумма mod 11; если 10 — веса 3..11,1,2; если снова 10 — ИИН невалиден.
 */
export const isValidIin = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{12}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
  let c = w1.reduce((s, w, i) => s + w * d[i], 0) % 11;
  if (c === 10) {
    c = w2.reduce((s, w, i) => s + w * d[i], 0) % 11;
    if (c === 10) return false;
  }
  return c === d[11];
};
