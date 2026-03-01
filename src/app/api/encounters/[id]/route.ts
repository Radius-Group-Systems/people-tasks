import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Encounter, Person } from "@/lib/types";

export const GET = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const encounter = await db.getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch participants
  const participants = await db.getMany<Person>(
    `SELECT p.* FROM people p
     JOIN encounter_participants ep ON ep.person_id = p.id
     WHERE ep.encounter_id = $1
     ORDER BY p.name`,
    [id]
  );

  return NextResponse.json({ ...encounter, participants });
});

/**
 * PATCH /api/encounters/[id]
 * Update encounter fields: title, notes, folder_id, encounter_type, summary.
 */
export const PATCH = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();

  const encounter = await db.getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await db.query<Encounter>(
    `UPDATE encounters SET
      title = $2,
      notes = $3,
      folder_id = $4,
      encounter_type = $5,
      summary = $6,
      project_id = $7
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.title !== undefined ? body.title : encounter.title,
      body.notes !== undefined ? body.notes : encounter.notes,
      body.folder_id !== undefined ? body.folder_id : encounter.folder_id,
      body.encounter_type !== undefined ? body.encounter_type : encounter.encounter_type,
      body.summary !== undefined ? body.summary : encounter.summary,
      body.project_id !== undefined ? body.project_id : encounter.project_id,
    ]
  );

  return NextResponse.json(result.rows[0]);
});

/**
 * DELETE /api/encounters/[id]
 * Cascade delete: removes linked action items, embeddings, participants, then the encounter.
 */
export const DELETE = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const encounter = await db.getOne<Encounter>(
    "SELECT id FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade: delete action items, embeddings, participants, then encounter
  await db.query("DELETE FROM action_items WHERE encounter_id = $1", [id]);
  await db.query(
    "DELETE FROM embeddings WHERE source_type = 'transcript' AND source_id = $1",
    [id]
  );
  await db.query("DELETE FROM encounter_participants WHERE encounter_id = $1", [id]);
  await db.query("DELETE FROM encounters WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
});
