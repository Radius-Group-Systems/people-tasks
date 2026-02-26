import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2",
});

const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

export async function invokeModel(
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    inferenceConfig: {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.2,
    },
  });

  const response = await client.send(command);
  const output = response.output;

  if (output && "message" in output && output.message?.content) {
    const textBlock = output.message.content.find((b) => "text" in b);
    if (textBlock && "text" in textBlock && textBlock.text) {
      return textBlock.text;
    }
  }

  throw new Error("No text response from Bedrock");
}

/**
 * Parse a JSON response from the model, stripping markdown fences if present.
 */
export function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}
