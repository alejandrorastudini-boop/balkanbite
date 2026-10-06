/**
 * Accepts common GTIN identities used by EAN/UPC retail products.
 * Formatting characters are not guessed or stripped: the reviewed identity
 * must be an exact 8/12/13/14-digit code with a valid GS1 check digit.
 */
export function normalizeValidRetailBarcode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;

  const digits = [...code].map(Number);
  const check = digits.pop()!;
  let sum = 0;
  let weight = 3;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += digits[index] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const expected = (10 - (sum % 10)) % 10;
  return check === expected ? code : null;
}
