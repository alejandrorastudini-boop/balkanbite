import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const translationsSource = fs.readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8",
);
const serviceWorkerSource = fs.readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
const profileSource = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);
const printMenuSource = fs.readFileSync(
  new URL("../src/components/PrintMenuModal.tsx", import.meta.url),
  "utf8",
);

test("current service worker is retirement-only, so product copy must not promise offline mode", () => {
  assert.match(serviceWorkerSource, /caches\.keys\(\)/);
  assert.match(serviceWorkerSource, /registration\.unregister\(\)/);
  assert.match(serviceWorkerSource, /reintroduce offline caching later/i);

  const installLines = translationsSource
    .split("\n")
    .filter((line) => line.includes("installAppDesc"))
    .join("\n");

  assert.doesNotMatch(installLines, /offline access|sin conexión|офлайн/i);
  assert.match(installLines, /Internet is still required for cloud sync and AI features/);
  assert.match(installLines, /siguen necesitando internet/);
  assert.match(installLines, /е необходим интернет/);
  assert.match(profileSource, /currentText\.installAppDesc/);
});

test("print-menu copy never guarantees savings", () => {
  const savingsLines = translationsSource
    .split("\n")
    .filter((line) => line.includes("bonAppetitSavings"))
    .join("\n");

  assert.doesNotMatch(
    savingsLines,
    /guaranteed savings|ahorro garantizado|гарантиран[ио]? спест/i,
  );
  assert.match(savingsLines, /track spending using the data you have provided/);
  assert.match(savingsLines, /Sigue tus gastos según los datos que has introducido/);
  assert.match(printMenuSource, /currentText\.bonAppetitSavings/);
});

test("legacy privacy copy contains no absolute protection or never-shared guarantee", () => {
  const privacyLines = translationsSource
    .split("\n")
    .filter((line) => line.includes("privacyGuarantee"))
    .join("\n");

  assert.doesNotMatch(
    privacyLines,
    /100% protected|100% respetada|никога не се споделят/i,
  );
  assert.match(privacyLines, /Privacy Policy/);
  assert.match(privacyLines, /Política de Privacidad/);
  assert.match(privacyLines, /Политиката за поверителност/);
});

test("scan guidance preserves human review authority", () => {
  const receiptLines = translationsSource
    .split("\n")
    .filter((line) => line.includes("receiptTipDesc"))
    .join("\n");

  assert.doesNotMatch(receiptLines, /perfect detection|detección perfecta/i);
  assert.match(receiptLines, /AI detections can be wrong/);
  assert.match(receiptLines, /La IA puede equivocarse/);
  assert.match(receiptLines, /AI разпознаването може да греши/);
  assert.match(receiptLines, /confirm the item details before saving/);
  assert.match(receiptLines, /confirma los datos antes de guardarlos/);
});
