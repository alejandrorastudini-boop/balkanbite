export interface BodyMetrics {
  heightCm?: number;
  weightKg?: number;
}

const positiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function calculateBmi(
  heightCm: unknown,
  weightKg: unknown,
): number | null {
  if (!positiveFinite(heightCm) || !positiveFinite(weightKg)) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Number.isFinite(bmi) ? bmi : null;
}

export function formatBmi(
  heightCm: unknown,
  weightKg: unknown,
): string | null {
  const bmi = calculateBmi(heightCm, weightKg);
  return bmi === null ? null : bmi.toFixed(1);
}
