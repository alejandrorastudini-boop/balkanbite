import type { Currency, Language } from "../types";

export function formatRecipeCostEUR(
  amountEUR: number,
  verified: boolean,
  requestedCurrency: Currency,
): string {
  if (
    !Number.isFinite(amountEUR) ||
    amountEUR < 0 ||
    (!verified && amountEUR === 0)
  ) {
    return "—";
  }
  const prefix = verified ? "" : "≈";
  const value = `${prefix}€${amountEUR.toFixed(2)}`;
  return requestedCurrency === "EUR" ? value : `${value} (EUR)`;
}

export function recipeCheapFilterLabel(
  requestedCurrency: Currency,
): string {
  return requestedCurrency === "EUR"
    ? "💰 ≈<3€"
    : "💰 ≈<3€ (EUR)";
}

export function recipeCostCurrencyNotice(
  requestedCurrency: Currency,
  language: Language,
): string | null {
  if (requestedCurrency === "EUR") return null;
  if (language === "bg") {
    return "Няма проверен валутен курс за тази стойност; цената остава показана в EUR.";
  }
  if (language === "es") {
    return "No hay un tipo de cambio verificado para este valor; el coste se mantiene en EUR.";
  }
  return "No verified exchange rate is available for this value; the cost remains in EUR.";
}
