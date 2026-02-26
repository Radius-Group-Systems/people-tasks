import { NextRequest, NextResponse } from "next/server";
import { getOne, query } from "@/lib/db";
import { Encounter } from "@/lib/types";
import { extractFromTranscript } from "@/lib/extractor";

/**
 * POST /api/encounters/[id]/extract
 * Run AI extraction on the encounter's transcript.
 * Returns extracted action items + summary for review (nothing saved yet).
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
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  if (!encounter.raw_transcript?.trim()) {
    return NextResponse.json(
      { error: "No transcript to extract from" },
      { status: 400 }
    );
  }

  try {
    const result = await extractFromTranscript(
      encounter.raw_transcript,
      encounter.summary,
      encounter.title
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
