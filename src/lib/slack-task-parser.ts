import { invokeModel, parseJsonResponse } from "./bedrock";

export interface ParsedSlackTask {
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_hint: string | null; // ISO date (YYYY-MM-DD) or null
}

/**
 * Parse a Slack message into a structured task using Bedrock (Claude).
 * The message is assumed to be someone asking Jeff to do something.
 */
export async function parseSlackMessage(
  messageText: string,
  senderName: string
): Promise<ParsedSlackTask> {
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const systemPrompt = `You parse Slack messages into task requests. The message is from someone asking Jeff to do something.

Today is ${dayOfWeek}, ${today}.

Extract:
- title: Clear, concise, imperative task title (max 100 chars). E.g., "Review Q3 budget proposal"
- description: Additional context from the message, or null if the title captures everything
- priority: Default "normal". Use "high" if words like "urgent", "ASAP", "critical", "important", "blocking" appear. Use "urgent" only for true emergencies. Use "low" for casual/non-time-sensitive asks.
- due_hint: Convert any date/time references to ISO format (YYYY-MM-DD):
  - "by Friday" → next Friday's date
  - "tomorrow" → tomorrow's date
  - "end of week" → this Friday
  - "next Monday" → next Monday
  - "ASAP" → today's date
  - No date mentioned → null

If the message contains multiple requests, use the most important as title and list others in description.

Respond ONLY with valid JSON:
{"title": "string", "description": "string or null", "priority": "low|normal|high|urgent", "due_hint": "YYYY-MM-DD or null"}`;

  const userMessage = `Message from ${senderName}:\n${messageText}`;

  const raw = await invokeModel(systemPrompt, userMessage, {
    maxTokens: 512,
    temperature: 0,
  });

  return parseJsonResponse<ParsedSlackTask>(raw);
}
