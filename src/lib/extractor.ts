import { invokeModel, parseJsonResponse } from "./bedrock";
import { getMany } from "./db";

interface ExtractedItem {
  title: string;
  description: string | null;
  owner_type: "me" | "them";
  person_name: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_hint: string | null; // "next meeting", a date string, or null
}

export interface ExtractionResult {
  summary: string;
  participants: string[];
  action_items: ExtractedItem[];
}

/**
 * Extract action items from a meeting transcript using Claude.
 * Passes known people names so the model can match them.
 */
export async function extractFromTranscript(
  transcript: string,
  summary?: string | null,
  meetingTitle?: string | null,
  participantNames?: string[],
  userName?: string | null
): Promise<ExtractionResult> {
  // Fetch known people for name matching
  const people = await getMany<{ name: string }>(
    "SELECT name FROM people ORDER BY name"
  );
  const knownNames = people.map((p) => p.name);

  const userIdentity = userName || "the user";

  const systemPrompt = `You extract action items from meeting transcripts. Be CONSERVATIVE — quality over quantity.

The app user is: ${userIdentity}. This is the person using the task management app.

WHAT COUNTS AS AN ACTION ITEM:
- Someone explicitly says "I will...", "I'll...", "Let me...", "I need to..."
- Someone is directly asked/told to do something and agrees or doesn't object
- A clear next step is agreed upon with a specific person responsible

WHAT IS NOT AN ACTION ITEM:
- General discussion topics or ideas that were just talked about
- Context, background, or things that already happened
- Vague intentions without a clear owner ("we should probably..." with no commitment)
- Sub-steps of a larger task — capture the top-level commitment, not every detail
- Things that are just describing the current situation

Keep the list tight — aim for the 3-8 most important commitments, not an exhaustive list of everything discussed. If Plaud or a human would summarize the meeting as having 5 next steps, you should find roughly 5, not 20.

For each action item:
- title: Clear, concise, imperative mood (e.g. "Send proposal to legal team")
- description: Brief additional context ONLY if needed, or null. Keep it short.
- owner_type: CRITICAL to get right.
  * "me" = ${userIdentity} personally committed to doing this
  * "them" = someone OTHER than ${userIdentity} is responsible
- person_name:
  * If owner_type is "me" → the person ${userIdentity} is doing it FOR or WITH
  * If owner_type is "them" → the person who committed to doing the work
  * Match to known names when possible
- priority: default "normal". Only use "high"/"urgent" if explicitly time-sensitive or emphasized.
- due_hint: only if a specific deadline was stated ("by Friday", "Thursday", "ASAP") or null

Also provide:
- A brief meeting summary (2-3 sentences)
- Participants: ONLY people who were actually IN the room speaking — not people merely mentioned

Known people in the system: ${knownNames.length > 0 ? knownNames.join(", ") : "(none yet)"}
${participantNames?.length ? `\nConfirmed meeting participants: ${participantNames.join(", ")}` : ""}

OWNER_TYPE RULES:
- Listen for WHO says "I will" / "I'll" / "Let me" — that person is the owner
- If ${userIdentity} says it → owner_type = "me"
- If anyone else says it → owner_type = "them", person_name = that person
- Pay close attention to the DIRECTION of actions (e.g., "Josh will share the doc with Jeff" → owner is Josh, not Jeff)
- When genuinely ambiguous, default to "me"

Respond ONLY with valid JSON:
{
  "summary": "string",
  "participants": ["string"],
  "action_items": [
    {
      "title": "string",
      "description": "string or null",
      "owner_type": "me | them",
      "person_name": "string or null",
      "priority": "low | normal | high | urgent",
      "due_hint": "string or null"
    }
  ]
}`;

  const userMessage = [
    meetingTitle ? `Meeting: ${meetingTitle}` : null,
    summary ? `Summary provided:\n${summary}` : null,
    `Transcript:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await invokeModel(systemPrompt, userMessage, {
    maxTokens: 2048,
    temperature: 0,
  });

  return parseJsonResponse<ExtractionResult>(raw);
}
