import assert from "node:assert/strict";
import test from "node:test";
import { withOpenAIJsonModeInstruction } from "../src/utils/openAIJsonMode.js";

test("JSON mode adds an explicit JSON instruction to string input", () => {
  const input = "Classify this request.";
  const prepared = withOpenAIJsonModeInstruction(input);

  assert.equal(typeof prepared, "string");
  assert.match(prepared as string, /JSON/);
  assert.match(prepared as string, /Classify this request\./);
});

test("JSON mode prepends an explicit JSON input message for multimodal input", () => {
  const original = [
    {
      role: "user",
      content: [
        { type: "input_text", text: "Inspect this image." },
        { type: "input_image", image_url: "data:image/jpeg;base64,abc" },
      ],
    },
  ];

  const prepared = withOpenAIJsonModeInstruction(original);
  assert.ok(Array.isArray(prepared));
  assert.match(JSON.stringify(prepared[0]), /JSON/);
  assert.deepEqual(prepared.slice(1), original);
});
