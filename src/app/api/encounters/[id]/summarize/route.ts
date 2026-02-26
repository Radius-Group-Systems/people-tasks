import { NextRequest, NextResponse } from "next/server";
import { getOne, getMany, query } from "@/lib/db";
import { Encounter } from "@/lib/types";
import { generateMeetingSummary } from "@/lib/summarizer";

/**
 * POST /api/encounters/[id]/summarize
 * Generate a structured meeting summary from the transcript.
 * Stores the result in encounters.detailed_summary (JSONB).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encounter = await getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!encounter.raw_transcript?.trim()) {
    return NextResponse.json(
      { error: "No transcript to summarize" },
      { status: 400 }
    );
  }

  try {
    const participants = await getMany<{ name: string }>(
      `SELECT p.name FROM people p
       JOIN encounter_participants ep ON ep.person_id = p.id
       WHERE ep.encounter_id = $1`,
      [id]
    );
    const participantNames = participants.map((p) => p.name);

    const summary = await generateMeetingSummary(
      encounter.raw_transcript,
      encounter.title,
      participantNames,
      encounter.occurred_at
    );

    // Store structured summary
    await query(
      "UPDATE encounters SET detailed_summary = $1 WHERE id = $2",
      [JSON.stringify(summary), id]
    );

    return NextResponse.json(summary);
  } catch (err) {
    console.error("Summarization failed:", err);
    return NextResponse.json(
      { error: "AI summarization failed" },
      { status: 500 }
    );
  }
}
