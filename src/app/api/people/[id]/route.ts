import { NextRequest, NextResponse } from "next/server";
import { getOne, query } from "@/lib/db";
import { Person } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const person = await getOne<Person>(
    `SELECT p.*,
      COUNT(CASE WHEN ai.owner_type = 'me' AND ai.status = 'open' THEN 1 END)::int AS open_items_count,
      COUNT(CASE WHEN ai.owner_type = 'them' AND ai.status = 'open' THEN 1 END)::int AS waiting_on_count
    FROM people p
    LEFT JOIN action_items ai ON ai.person_id = p.id
    WHERE p.id = $1
    GROUP BY p.id`,
    [id]
  );

  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(person);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, slack_handle, organization, notes } = body;

  const result = await query<Person>(
    `UPDATE people SET
      name = COALESCE($2, name),
      email = COALESCE($3, email),
      phone = COALESCE($4, phone),
      slack_handle = COALESCE($5, slack_handle),
      organization = COALESCE($6, organization),
      notes = COALESCE($7, notes),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [id, name, email, phone, slack_handle, organization, notes]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await query("DELETE FROM people WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
