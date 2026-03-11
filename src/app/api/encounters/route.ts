import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Encounter } from "@/lib/types";

export const GET = withAuth(async (req, { db }) => {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");

  let encounters: (Encounter & { participant_count?: number; action_item_count?: number; participant_names?: string })[];

  if (personId) {
    encounters = await db.getMany(`
      SELECT e.id, e.title, e.encounter_type, e.occurred_at, e.summary, e.raw_transcript,
        e.source, e.source_file_path, e.folder_id, e.notes, e.email_message_id,
        e.email_from, e.email_attachments, e.project_id, e.created_at,
        (SELECT COUNT(*) FROM encounter_participants ep2 WHERE ep2.encounter_id = e.id)::int AS participant_count,
        (SELECT COUNT(*) FROM action_items ai WHERE ai.encounter_id = e.id)::int AS action_item_count,
        (SELECT STRING_AGG(p.name, ', ' ORDER BY p.name) FROM people p JOIN encounter_participants ep3 ON ep3.person_id = p.id WHERE ep3.encounter_id = e.id) AS participant_names,
        ef.name AS folder_name,
        ef.color AS folder_color,
        proj.name AS project_name,
        proj.color AS project_color
      FROM encounters e
      JOIN encounter_participants ep ON ep.encounter_id = e.id
      LEFT JOIN encounter_folders ef ON ef.id = e.folder_id
      LEFT JOIN projects proj ON proj.id = e.project_id
      WHERE ep.person_id = $1
      ORDER BY e.occurred_at DESC
    `, [personId]);
  } else {
    encounters = await db.getMany(`
      SELECT e.id, e.title, e.encounter_type, e.occurred_at, e.summary, e.raw_transcript,
        e.source, e.source_file_path, e.folder_id, e.notes, e.email_message_id,
        e.email_from, e.email_attachments, e.project_id, e.created_at,
        (SELECT COUNT(*) FROM encounter_participants ep WHERE ep.encounter_id = e.id)::int AS participant_count,
        (SELECT COUNT(*) FROM action_items ai WHERE ai.encounter_id = e.id)::int AS action_item_count,
        (SELECT STRING_AGG(p.name, ', ' ORDER BY p.name) FROM people p JOIN encounter_participants ep2 ON ep2.person_id = p.id WHERE ep2.encounter_id = e.id) AS participant_names,
        ef.name AS folder_name,
        ef.color AS folder_color,
        proj.name AS project_name,
        proj.color AS project_color
      FROM encounters e
      LEFT JOIN encounter_folders ef ON ef.id = e.folder_id
      LEFT JOIN projects proj ON proj.id = e.project_id
      ORDER BY e.occurred_at DESC
    `);
  }

  return NextResponse.json(encounters);
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const {
    title, encounter_type, occurred_at, summary,
    raw_transcript, source, source_file_path, participant_ids, project_id,
    calendar_event_id,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json({ error: "Title too long (max 500 chars)" }, { status: 400 });
  }

  const result = await db.query<Encounter>(
    `INSERT INTO encounters (title, encounter_type, occurred_at, summary, raw_transcript, source, source_file_path, project_id, org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      title.trim(),
      encounter_type || "meeting",
      occurred_at || new Date().toISOString(),
      summary || null,
      raw_transcript || null,
      source || "manual",
      source_file_path || null,
      project_id || null,
      orgId,
    ]
  );

  const encounter = result.rows[0];

  // Link participants if provided
  if (participant_ids?.length) {
    for (const pid of participant_ids) {
      await db.query(
        `INSERT INTO encounter_participants (encounter_id, person_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [encounter.id, pid]
      );
    }
  }

  // Link calendar event if provided
  if (calendar_event_id) {
    await db.query(
      `UPDATE calendar_events SET encounter_id = $1 WHERE id = $2`,
      [encounter.id, calendar_event_id]
    );
  }

  return NextResponse.json(encounter, { status: 201 });
});
