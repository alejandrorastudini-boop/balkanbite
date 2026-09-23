import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const bottomNavSource = readFileSync(
  new URL("../src/components/BottomNav.tsx", import.meta.url),
  "utf8"
);
const headerSource = readFileSync(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8"
);
const homeViewSource = readFileSync(
  new URL("../src/components/HomeView.tsx", import.meta.url),
  "utf8"
);
const translationsSource = readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8"
);

test("BottomNav places Home at the start, directly to the left of Pantry", () => {
  // Check that home precedes pantry in the navItems array
  const homeIndex = bottomNavSource.indexOf('id: "home"');
  const pantryIndex = bottomNavSource.indexOf('id: "pantry"');
  assert.ok(homeIndex >= 0, "BottomNav must define 'home' tab");
  assert.ok(pantryIndex >= 0, "BottomNav must define 'pantry' tab");
  assert.ok(homeIndex < pantryIndex, "Home must be to the left of Pantry");
});

test("BottomNav does not contain profile in the bottom bar", () => {
  const navItemsStart = bottomNavSource.indexOf("const navItems = [");
  const navItemsEnd = bottomNavSource.indexOf("];", navItemsStart);
  assert.ok(navItemsStart >= 0 && navItemsEnd > navItemsStart);
  const navItemsBlock = bottomNavSource.slice(navItemsStart, navItemsEnd);

  assert.doesNotMatch(
    navItemsBlock,
    /id:\s*"profile"/,
    "Profile must not be an item in the bottom navigation bar"
  );
});

test("Header provides profile access in the top-right corner", () => {
  assert.match(
    headerSource,
    /onOpenProfile/,
    "Header must accept onOpenProfile prop"
  );
  assert.match(
    headerSource,
    /id="header-profile-btn"/,
    "Header must include header-profile-btn"
  );
  assert.match(
    headerSource,
    /onOpenProfile\(\)/,
    "Clicking the profile button must invoke onOpenProfile"
  );
});

test("App passes onOpenProfile and activeTab to Header and mounts HomeView", () => {
  assert.match(
    appSource,
    /onOpenProfile=\{[^}]*setActiveTab\("profile"\)[^}]*\}/,
    "App must pass onOpenProfile to Header which sets activeTab to profile"
  );
  assert.match(
    appSource,
    /\{activeTab === "home" && \(\s*<HomeView/,
    "App must render HomeView when activeTab is home"
  );
});

test("HomeView is exported and contains culinary dashboard elements", () => {
  assert.match(homeViewSource, /export const HomeView/);
  assert.match(homeViewSource, /onNavigateToTab/);
  assert.match(homeViewSource, /onOpenChefIa/);
});

test("translations include navHome for en, bg, and es", () => {
  assert.match(translationsSource, /navHome:\s*"Home"/);
  assert.match(translationsSource, /navHome:\s*"Начало"/);
  assert.match(translationsSource, /navHome:\s*"Inicio"/);
});
