import { NextRequest, NextResponse } from "next/server";
import { getMany, query } from "@/lib/db";
import { Person } from "@/lib/types";

export async function GET() {
  const people = await getMany<Person>(`
    SELECT p.*,
      COUNT(CASE WHEN ai.owner_type = 'me' AND ai.status = 'open' THEN 1 END)::int AS open_items_count,
      COUNT(CASE WHEN ai.owner_type = 'them' AND ai.status = 'open' THEN 1 END)::int AS waiting_on_count,
      COUNT(CASE WHEN ai.status = 'in_progress' THEN 1 END)::int AS in_progress_count,
      COUNT(CASE WHEN ai.status = 'done' THEN 1 END)::int AS done_count,
      enc_stats.last_encounter_at,
      COALESCE(enc_stats.encounter_count, 0)::int AS encounter_count
    FROM people p
    LEFT JOIN action_items ai ON ai.person_id = p.id
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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, slack_handle, organization, notes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await query<Person>(
    `INSERT INTO people (name, email, phone, slack_handle, organization, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name.trim(), email || null, phone || null, slack_handle || null, organization || null, notes || null]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}
