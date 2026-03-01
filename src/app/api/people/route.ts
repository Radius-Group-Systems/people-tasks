import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Person } from "@/lib/types";

export const GET = withAuth(async (req, { db }) => {
  const people = await db.getMany<Person>(`
    SELECT p.*,
      COUNT(CASE WHEN ai.owner_type = 'me' AND ai.status = 'open' THEN 1 END)::int AS open_items_count,
      COUNT(CASE WHEN ai.owner_type = 'them' AND ai.status = 'open' THEN 1 END)::int AS waiting_on_count,
      COUNT(CASE WHEN ai.status = 'in_progress' THEN 1 END)::int AS in_progress_count,
      COUNT(CASE WHEN ai.status = 'done' THEN 1 END)::int AS done_count,
      enc_stats.last_encounter_at,
      COALESCE(enc_stats.encounter_count, 0)::int AS encounter_count
    FROM people p
    LEFT JOIN action_items ai ON ai.person_id = p.id OR ai.source_person_id = p.id
    LEFT JOIN LATERAL (
      SELECT MAX(e.occurred_at) AS last_encounter_at, COUNT(*)::int AS encounter_count
      FROM encounter_participants ep
      JOIN encounters e ON e.id = ep.encounter_id
      WHERE ep.person_id = p.id
    ) enc_stats ON true
    GROUP BY p.id, enc_stats.last_encounter_at, enc_stats.encounter_count
    ORDER BY p.name
  `);
  return NextResponse.json(people);
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const { name, email, phone, slack_handle, organization, notes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await db.query<Person>(
    `INSERT INTO people (name, email, phone, slack_handle, organization, notes, org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name.trim(), email || null, phone || null, slack_handle || null, organization || null, notes || null, orgId]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
});
