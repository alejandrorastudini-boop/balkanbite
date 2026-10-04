import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("home recipe shortcut reports stored recipe count without claiming readiness", () => {
  const home = fs.readFileSync("src/components/HomeView.tsx", "utf8");
  assert.doesNotMatch(home, /recetas listas/);
  assert.doesNotMatch(home, /ready recipes/);
  assert.match(
    home,
    /recipes\.length\} \{language === "es" \? "recetas" : language === "bg" \? "рецепти" : "recipes"/,
  );
});
