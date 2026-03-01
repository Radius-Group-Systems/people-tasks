import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

interface DelegationChainRow {
  id: number;
  action_item_id: number;
  from_person_id: number | null;
  to_person_id: number | null;
  via_person_id: number | null;
  status: string;
  created_at: string;
  from_name: string | null;
  to_name: string | null;
  via_name: string | null;
  task_title: string;
}

export const GET = withAuth(async (req, { db }) => {
  const { searchParams } = new URL(req.url);
  const actionItemId = searchParams.get("action_item_id");
  const status = searchParams.get("status");

  let where = "";
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (actionItemId) {
    conditions.push(`dc.action_item_id = $${idx++}`);
    params.push(actionItemId);
  }
  if (status) {
    conditions.push(`dc.status = $${idx++}`);
    params.push(status);
  }

  if (conditions.length) where = `WHERE ${conditions.join(" AND ")}`;

  const chains = await db.getMany<DelegationChainRow>(`
    SELECT dc.*,
      fp.name AS from_name,
      tp.name AS to_name,
      vp.name AS via_name,
      ai.title AS task_title
    FROM delegation_chains dc
    LEFT JOIN people fp ON fp.id = dc.from_person_id
    LEFT JOIN people tp ON tp.id = dc.to_person_id
    LEFT JOIN people vp ON vp.id = dc.via_person_id
    LEFT JOIN action_items ai ON ai.id = dc.action_item_id
    ${where}
    ORDER BY dc.created_at DESC
  `, params);

  return NextResponse.json(chains);
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const { action_item_id, from_person_id, to_person_id, via_person_id } = body;

  if (!action_item_id) {
    return NextResponse.json({ error: "action_item_id required" }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO delegation_chains (action_item_id, from_person_id, to_person_id, via_person_id, org_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [action_item_id, from_person_id || null, to_person_id || null, via_person_id || null, orgId]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
});
