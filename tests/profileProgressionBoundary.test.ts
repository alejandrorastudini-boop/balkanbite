import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profileSource = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);
const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

test("profile renders only the derived verified activity summary", () => {
  assert.match(profileSource, /profile-verified-activity-card/);
  assert.match(profileSource, /progressionSummary\.totalVerifiedEvents/);
  assert.match(profileSource, /progressionSummary\.confirmedPurchaseEvents/);
  assert.match(profileSource, /progressionSummary\.successfulCookEvents/);
  assert.match(appSource, /summarizeProgressionActivity\(progressionLedger\)/);
  assert.match(appSource, /progressionSummary=\{progressionSummary\}/);
});

test("progression profile copy is transparent about health and reward boundaries", () => {
  assert.match(
    profileSource,
    /This is not a health score or a reward balance\./,
  );
  assert.match(
    profileSource,
    /Esto no es una puntuación de salud ni un saldo de recompensas\./,
  );
  assert.match(
    profileSource,
    /Не оценява тегло, калории или медицински резултати\./,
  );
});

test("progression zero state is neutral and does not frame absence as failure", () => {
  assert.match(profileSource, /profile-progress-zero-copy/);
  assert.match(profileSource, /This is not a negative result/);
  assert.match(profileSource, /No es un resultado negativo/);
});

test("profile progression slice does not expose commercial reward mechanics", () => {
  const start = profileSource.indexOf('id="profile-verified-activity-card"');
  const end = profileSource.indexOf("BalkanBite Logo Showcase", start);
  assert.ok(start >= 0 && end > start);
  const cardSource = profileSource.slice(start, end);

  assert.doesNotMatch(cardSource, /BalkanCredits?/i);
  assert.doesNotMatch(cardSource, /cash|money|voucher|redeem|reward amount/i);
  assert.doesNotMatch(cardSource, /weight loss|calorie restriction|fasting/i);
});


test("progression profile discloses that activity history is device-local", () => {
  assert.match(profileSource, /profile-progress-storage-copy/);
  assert.match(
    profileSource,
    /stored only on this device and is not synced to your account/,
  );
  assert.match(
    profileSource,
    /se guarda solo en este dispositivo y no se sincroniza con tu cuenta/,
  );
  assert.match(
    profileSource,
    /се съхранява само на това устройство и не се синхронизира с вашия акаунт/,
  );
});
