import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Person } from "@/lib/types";

export const GET = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const person = await db.getOne<Person>(
    `SELECT p.*,
      COUNT(CASE WHEN ai.owner_type = 'me' AND ai.status = 'open' THEN 1 END)::int AS open_items_count,
      COUNT(CASE WHEN ai.owner_type = 'them' AND ai.status = 'open' THEN 1 END)::int AS waiting_on_count
    FROM people p
    LEFT JOIN action_items ai ON ai.person_id = p.id OR ai.source_person_id = p.id
    WHERE p.id = $1
    GROUP BY p.id`,
    [id]
  );

  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(person);
});

export const PATCH = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();

  // Build dynamic SET clause — only update fields present in the body
  const fields: string[] = [];
  const values: unknown[] = [id];
  let idx = 2;

  // String fields — empty string → null
  const stringFields = ["name", "email", "phone", "slack_handle", "organization", "notes", "prep_notes", "next_meeting_at"] as const;
  for (const key of stringFields) {
    if (key in body) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key] || null);
    }
  }

  // JSON fields — store as-is
  const jsonFields = ["talking_points"] as const;
  for (const key of jsonFields) {
    if (key in body) {
      fields.push(`${key} = $${idx++}`);
      values.push(JSON.stringify(body[key]));
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  fields.push("updated_at = NOW()");

  const result = await db.query<Person>(
    `UPDATE people SET ${fields.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
});

export const DELETE = withAuth(async (req, { db }, params) => {
  const id = params!.id;

  // Check if person exists
  const person = await db.getOne("SELECT id FROM people WHERE id = $1", [id]);
  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade: nullify references in action_items
  await db.query("UPDATE action_items SET person_id = NULL WHERE person_id = $1", [id]);
  await db.query("UPDATE action_items SET source_person_id = NULL WHERE source_person_id = $1", [id]);

  // Remove from encounter_participants
  await db.query("DELETE FROM encounter_participants WHERE person_id = $1", [id]);

  // Remove embeddings referencing this person
  await db.query("DELETE FROM embeddings WHERE source_type = 'person' AND source_id = $1", [id]);

  // Delete the person
  await db.query("DELETE FROM people WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
});
