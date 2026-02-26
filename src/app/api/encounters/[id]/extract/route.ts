import { NextRequest, NextResponse } from "next/server";
import { getOne, getMany, query } from "@/lib/db";
import { Encounter } from "@/lib/types";
import { extractFromTranscript } from "@/lib/extractor";

/**
 * POST /api/encounters/[id]/extract
 * Run AI extraction on the encounter's transcript.
 * Returns extracted action items + summary for review (nothing saved yet).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // The client can send { user_person_id } so we know who "me" is
  let userPersonId: string | null = null;
  try {
    const body = await req.json();
    userPersonId = body.user_person_id ?? null;
  } catch {
    // No body is fine — we'll just skip userName
  }

  const encounter = await getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  if (!encounter.raw_transcript?.trim()) {
    return NextResponse.json(
      { error: "No transcript to extract from" },
      { status: 400 }
    );
  }

  try {
    // Get linked participant names to give Claude a head start
    const participants = await getMany<{ name: string }>(
      `SELECT p.name FROM people p
       JOIN encounter_participants ep ON ep.person_id = p.id
       WHERE ep.encounter_id = $1`,
      [id]
    );
    const participantNames = participants.map((p) => p.name);

    // Look up the user's name so Claude knows who "me" is
    let userName: string | null = null;
    if (userPersonId) {
      const userPerson = await getOne<{ name: string }>(
        "SELECT name FROM people WHERE id = $1",
        [userPersonId]
      );
      userName = userPerson?.name ?? null;
    }

    const result = await extractFromTranscript(
      encounter.raw_transcript,
      encounter.summary,
      encounter.title,
      participantNames,
      userName
    );

    // Update encounter summary if the AI generated one and there isn't one already
    if (result.summary && !encounter.summary) {
      await query(
        "UPDATE encounters SET summary = $1 WHERE id = $2",
        [result.summary, id]
      );
    }

    return NextResponse.json({
      encounter_id: parseInt(id),
      ...result,
    });
  } catch (err) {
    console.error("Extraction failed:", err);
    return NextResponse.json(
      { error: "AI extraction failed. Check Bedrock configuration." },
      { status: 500 }
    );
  }
}
