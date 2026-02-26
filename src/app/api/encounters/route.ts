import { NextRequest, NextResponse } from "next/server";
import { getMany, query } from "@/lib/db";
import { Encounter } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");

  let encounters: (Encounter & { participant_count?: number; action_item_count?: number; participant_names?: string })[];

  if (personId) {
    encounters = await getMany(`
      SELECT e.*,
        (SELECT COUNT(*) FROM encounter_participants ep2 WHERE ep2.encounter_id = e.id)::int AS participant_count,
        (SELECT COUNT(*) FROM action_items ai WHERE ai.encounter_id = e.id)::int AS action_item_count,
        (SELECT STRING_AGG(p.name, ', ' ORDER BY p.name) FROM people p JOIN encounter_participants ep3 ON ep3.person_id = p.id WHERE ep3.encounter_id = e.id) AS participant_names,
        ef.name AS folder_name,
        ef.color AS folder_color
      FROM encounters e
      JOIN encounter_participants ep ON ep.encounter_id = e.id
      LEFT JOIN encounter_folders ef ON ef.id = e.folder_id
      WHERE ep.person_id = $1
      ORDER BY e.occurred_at DESC
    `, [personId]);
  } else {
    encounters = await getMany(`
      SELECT e.*,
        (SELECT COUNT(*) FROM encounter_participants ep WHERE ep.encounter_id = e.id)::int AS participant_count,
        (SELECT COUNT(*) FROM action_items ai WHERE ai.encounter_id = e.id)::int AS action_item_count,
        (SELECT STRING_AGG(p.name, ', ' ORDER BY p.name) FROM people p JOIN encounter_participants ep2 ON ep2.person_id = p.id WHERE ep2.encounter_id = e.id) AS participant_names,
        ef.name AS folder_name,
        ef.color AS folder_color
      FROM encounters e
      LEFT JOIN encounter_folders ef ON ef.id = e.folder_id
      ORDER BY e.occurred_at DESC
    `);
  }

  return NextResponse.json(encounters);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title, encounter_type, occurred_at, summary,
    raw_transcript, source, source_file_path, participant_ids
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await query<Encounter>(
    `INSERT INTO encounters (title, encounter_type, occurred_at, summary, raw_transcript, source, source_file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      title.trim(),
      encounter_type || "meeting",
      occurred_at || new Date().toISOString(),
      summary || null,
      raw_transcript || null,
      source || "manual",
      source_file_path || null,
    ]
  );

  const encounter = result.rows[0];

  // Link participants if provided
  if (participant_ids?.length) {
    for (const pid of participant_ids) {
      await query(
        `INSERT INTO encounter_participants (encounter_id, person_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [encounter.id, pid]
      );
    }
  }

  return NextResponse.json(encounter, { status: 201 });
}
