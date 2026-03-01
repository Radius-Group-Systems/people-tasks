import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Encounter, MeetingSummary } from "@/lib/types";
import { generateMeetingSummary } from "@/lib/summarizer";

/**
 * POST /api/encounters/[id]/extract
 * Generate a detailed summary and convert topics into tasks with checklist subtasks.
 * Each topic becomes an action item: title = topic, description = conclusion, checklist = next_steps.
 * Returns extracted items + summary for review (nothing saved yet).
 */
export const POST = withAuth(async (req, { db }, params) => {
  const id = params!.id;

  // The client can send { user_person_id } so we know who "me" is
  let userPersonId: string | null = null;
  try {
    const body = await req.json();
    userPersonId = body.user_person_id ?? null;
  } catch {
    // No body is fine
  }

  const encounter = await db.getOne<Encounter>(
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
    // Get linked participant names
    const participants = await db.getMany<{ name: string }>(
      `SELECT p.name FROM people p
       JOIN encounter_participants ep ON ep.person_id = p.id
       WHERE ep.encounter_id = $1`,
      [id]
    );
    const participantNames = participants.map((p) => p.name);

    // Look up the user's name
    let userName: string | null = null;
    if (userPersonId) {
      const userPerson = await db.getOne<{ name: string }>(
        "SELECT name FROM people WHERE id = $1",
        [userPersonId]
      );
      userName = userPerson?.name ?? null;
    }

    // Generate detailed summary (or use existing one)
    let detailedSummary: MeetingSummary;
    if (encounter.detailed_summary) {
      detailedSummary = encounter.detailed_summary;
    } else {
      detailedSummary = await generateMeetingSummary(
        encounter.raw_transcript,
        encounter.title,
        participantNames,
        encounter.occurred_at
      );

      // Save the detailed summary
      await db.query(
        "UPDATE encounters SET detailed_summary = $1 WHERE id = $2",
        [JSON.stringify(detailedSummary), id]
      );

      // Also save the overall_summary if we don't have one
      if (!encounter.summary && detailedSummary.overall_summary) {
        await db.query(
          "UPDATE encounters SET summary = $1 WHERE id = $2",
          [detailedSummary.overall_summary, id]
        );
      }
    }

    // Convert topics → action items with checklist subtasks
    const actionItems = detailedSummary.topics.map((topic) => ({
      title: topic.topic,
      description: topic.conclusion,
      owner_type: "me" as const,
      person_name: null as string | null,
      priority: "normal" as const,
      due_hint: null as string | null,
      checklist: topic.next_steps.map((step) => ({
        id: crypto.randomUUID(),
        text: step,
        done: false,
      })),
      discussion_points: topic.discussion_points,
    }));

    return NextResponse.json({
      encounter_id: parseInt(id),
      summary: detailedSummary.overall_summary,
      participants: detailedSummary.attendees,
      action_items: actionItems,
      user_name: userName,
    });
  } catch (err) {
    console.error("Extraction failed:", err);
    return NextResponse.json(
      { error: "AI extraction failed. Check Bedrock configuration." },
      { status: 500 }
    );
  }
});
