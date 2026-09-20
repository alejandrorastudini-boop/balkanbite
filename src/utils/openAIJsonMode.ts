const JSON_MODE_INSTRUCTION = "Return the final response as JSON.";

export function withOpenAIJsonModeInstruction(input: unknown): unknown {
  if (typeof input === "string") {
    return `${JSON_MODE_INSTRUCTION}\n\n${input}`;
  }

  const jsonInstructionMessage = {
    role: "user",
    content: [{ type: "input_text", text: JSON_MODE_INSTRUCTION }],
  };

  return [
    jsonInstructionMessage,
    ...(Array.isArray(input) ? input : [input]),
  ];
}
