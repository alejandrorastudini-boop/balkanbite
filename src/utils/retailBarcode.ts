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

/**
 * UPC-E is a zero-suppressed UPC-A identity, NOT an EAN-8/GTIN-8.
 * Expand only an explicitly identified complete 8-digit UPC-E value.
 * Its check digit is validated against the expanded 12-digit UPC-A.
 *
 * GS1 General Specifications §5.2.2.4.2 (UPC-E decoding).
 * Missing number-system/check digits are never guessed.
 */
export function expandValidUpcEToUpcA(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim();
  if (!/^[01]\d{7}$/.test(compact)) return null;

  const numberSystem = compact[0];
  const encoded = compact.slice(1, 7);
  const checkDigit = compact[7];
  const selector = encoded[5];
  let expandedBody: string;
  if (selector === "0" || selector === "1" || selector === "2") {
    expandedBody = encoded.slice(0, 2) + selector + "0000" + encoded.slice(2, 5);
  } else if (selector === "3") {
    expandedBody = encoded.slice(0, 3) + "00000" + encoded.slice(3, 5);
  } else if (selector === "4") {
    expandedBody = encoded.slice(0, 4) + "00000" + encoded[4];
  } else {
    expandedBody = encoded.slice(0, 5) + "0000" + selector;
  }

  const upcA = numberSystem + expandedBody + checkDigit;
  return normalizeValidRetailBarcode(upcA);
}
