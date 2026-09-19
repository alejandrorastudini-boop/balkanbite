import type { Language } from "../types";

export type RecipeCookOutcome =
  | { success: true }
  | { success: false; issueCount: number };

export interface RecipeCookFeedback {
  kind: "success" | "error";
  text: string;
}

export function getRecipeCookFeedback(
  outcome: RecipeCookOutcome,
  language: Language,
  successText: string,
): RecipeCookFeedback {
  if (outcome.success) {
    return { kind: "success", text: successText };
  }

  const count = Number.isFinite(outcome.issueCount) && outcome.issueCount > 0
    ? outcome.issueCount
    : 1;

  if (language === "bg") {
    return {
      kind: "error",
      text: `Не отбелязах ястието като сготвено: ${count} съставка(и) не могат да бъдат приспаднати надеждно от наличностите.`,
    };
  }
  if (language === "es") {
    return {
      kind: "error",
      text: `No marqué la receta como cocinada: ${count} ingrediente(s) no pueden descontarse de la despensa de forma segura.`,
    };
  }
  return {
    kind: "error",
    text: `I did not mark the recipe as cooked: ${count} ingredient(s) cannot be safely deducted from the pantry.`,
  };
}
