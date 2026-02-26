import { invokeModel, parseJsonResponse } from "./bedrock";

export interface DiscussionTopic {
  topic: string;
  conclusion: string;
  next_steps: string[];
  discussion_points: {
    viewpoint: string;
    supporting_detail: string | null;
  }[];
}

export interface MeetingSummary {
  title: string;
  attendees: string[];
  topics: DiscussionTopic[];
  overall_summary: string;
}

/**
 * Generate a structured meeting summary from a transcript.
 * Follows the Discussion Meeting format: topics → conclusions → next steps → discussion points.
 */
export async function generateMeetingSummary(
  transcript: string,
  meetingTitle?: string | null,
  participantNames?: string[],
  occurredAt?: string | null
): Promise<MeetingSummary> {
  const dateStr = occurredAt
    ? new Date(occurredAt).toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Unknown date";

  const systemPrompt = `You produce structured meeting summaries. Given a transcript, identify the distinct topics discussed and for each one provide the conclusion reached, concrete next steps, and key discussion points.

Be thorough but concise. Capture what matters — decisions made, disagreements, important context — without padding.

For each discussion point, include the viewpoint expressed and any supporting facts, examples, arguments, or questions that were raised.

Respond ONLY with valid JSON matching this schema:
{
  "title": "string — a clear descriptive title for this meeting",
  "attendees": ["string — names of people who actually spoke/attended"],
  "topics": [
    {
      "topic": "string — the subject discussed",
      "conclusion": "string — what was decided or agreed upon",
      "next_steps": ["string — specific action items or follow-ups from this topic"],
      "discussion_points": [
        {
          "viewpoint": "string — a position or idea expressed, attributed to who said it",
          "supporting_detail": "string or null — facts, examples, arguments, or questions presented"
        }
      ]
    }
  ],
  "overall_summary": "string — 2-3 sentence high-level summary of the entire meeting"
}`;

  const userMessage = [
    `Meeting: ${meetingTitle || "Untitled Meeting"}`,
    `Date: ${dateStr}`,
    participantNames?.length
      ? `Known attendees: ${participantNames.join(", ")}`
      : null,
    `\nTranscript:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await invokeModel(systemPrompt, userMessage, {
    maxTokens: 4096,
    temperature: 0,
  });

  return parseJsonResponse<MeetingSummary>(raw);
}
