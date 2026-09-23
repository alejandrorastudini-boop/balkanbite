import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync(
  new URL("../src/components/AuthModal.tsx", import.meta.url), "utf8",
);
const app = readFileSync(
  new URL("../src/App.tsx", import.meta.url), "utf8",
);

test("successful sign-out returns to account landing before guest onboarding can cover the login action", () => {
  assert.match(auth, /await logout\(\);\s*onSignedOut\?\.\(\);\s*onClose\(\);/);
  assert.match(app, /onSignedOut=\{\(\) => setShowLanding\(true\)\}/);
  assert.match(app, /if \(showLanding\) \{\s*return \(\s*<LandingPage/);
  assert.match(
    app,
    /isOpen=\{\s*!showLanding\s*&&\s*!showAuthModal\s*&&\s*\(!currentUser \|\| profileHydrated\)/,
  );
});

test("sign-out failure does not claim successful logout or navigate to landing", () => {
  const signoutHandler = auth.match(
    /const handleSignOut = async \(\) => \{[\s\S]*?\n  \};/,
  )?.[0];
  assert.ok(signoutHandler, "Missing sign-out handler");
  assert.match(signoutHandler, /await logout\(\);/);
  assert.match(signoutHandler, /catch \(err\)/);
  assert.ok(signoutHandler.indexOf("onSignedOut?.()") <
    signoutHandler.indexOf("} catch (err)"));
});
