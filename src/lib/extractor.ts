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
  meetingTitle?: string | null
): Promise<ExtractionResult> {
  // Fetch known people for name matching
  const people = await getMany<{ name: string }>(
    "SELECT name FROM people ORDER BY name"
  );
  const knownNames = people.map((p) => p.name);

  const systemPrompt = `You are an assistant that extracts action items from meeting transcripts.

You will be given a meeting transcript and optionally a summary. Your job:
1. Identify all action items — things someone committed to do, was asked to do, or needs to follow up on.
2. For each item, determine:
   - A clear, concise title (imperative mood, e.g. "Send proposal to legal team")
   - An optional description with more context
   - owner_type: "me" if the user (the person who recorded this) needs to do it, "them" if someone else does
   - person_name: who the item is about/assigned to (match to known names when possible)
   - priority: infer from urgency cues in conversation (default "normal")
   - due_hint: any deadline mentioned ("by Friday", "next meeting", "end of month", "ASAP") or null
3. Also provide a brief summary of the meeting (2-3 sentences) and a list of participant names mentioned.

Known people in the system: ${knownNames.length > 0 ? knownNames.join(", ") : "(none yet)"}

The user recording this meeting is referred to as "I", "me", or their name. When "I" commit to something, owner_type = "me". When someone else commits, owner_type = "them".

Respond ONLY with valid JSON matching this schema:
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
    maxTokens: 4096,
    temperature: 0.1,
  });

  return parseJsonResponse<ExtractionResult>(raw);
}
