import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

test("server-side source imports are ESM-safe for Vercel runtime", () => {
  assert.match(
    serverSource,
    /from "\.\/src\/utils\/aiCulinaryProfileContext\.js";/,
  );
  assert.doesNotMatch(
    serverSource,
    /from "\.\/src\/utils\/aiCulinaryProfileContext";/,
  );
});
