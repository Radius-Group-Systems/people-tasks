import { invokeModel, parseJsonResponse } from "./bedrock";

export interface ParsedSlackLink {
  url: string;
  label: string | null;
}

export interface ParsedSlackTask {
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_hint: string | null; // ISO date (YYYY-MM-DD) or null
  links: ParsedSlackLink[];
}

/**
 * Extract URLs from Slack's mrkdwn format: <https://url|label> or <https://url>
 */
export function extractSlackLinks(text: string): ParsedSlackLink[] {
  const links: ParsedSlackLink[] = [];
  const linkRegex = /<(https?:\/\/[^|>]+)(?:\|([^>]+))?>/g;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ url: match[1], label: match[2] || null });
  }
  return links;
}

/**
 * Clean Slack mrkdwn formatting from message text for the LLM.
 * Converts <https://url|label> to just "label (url)" for readability.
 */
function cleanSlackText(text: string): string {
  return text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/<@[A-Z0-9]+>/g, "") // remove @mentions
    .trim();
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

  // Extract links before sending to LLM
  const links = extractSlackLinks(messageText);
  const cleanedText = cleanSlackText(messageText);

  const systemPrompt = `You parse Slack messages into task requests. The message is from someone asking Jeff to do something.

Today is ${dayOfWeek}, ${today}.

Extract:
- title: Clear, concise, imperative task title (max 100 chars). E.g., "Review Q3 budget proposal"
- description: Additional context from the message, or null if the title captures everything. If there are links or files mentioned, note their purpose in the description.
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

  const userMessage = `Message from ${senderName}:\n${cleanedText}`;

  const raw = await invokeModel(systemPrompt, userMessage, {
    maxTokens: 512,
    temperature: 0,
  });

  const parsed = parseJsonResponse<Omit<ParsedSlackTask, "links">>(raw);
  return { ...parsed, links };
}
