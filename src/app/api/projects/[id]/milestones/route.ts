import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Milestone } from "@/lib/types";

export const GET = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const milestones = await db.getMany<Milestone>(`
    SELECT m.*,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.milestone_id = m.id)::int AS task_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.milestone_id = m.id AND ai.status = 'done')::int AS done_count
    FROM milestones m
    WHERE m.project_id = $1
    ORDER BY m.sort_order, m.created_at
  `, [id]);

  return NextResponse.json(milestones);
});

/**
 * POST /api/projects/[id]/milestones
 * Body: { title, description?, target_date?, sort_order? }
 */
export const POST = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();
  const { title, description, target_date, sort_order } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Auto-assign sort_order if not provided
  let order = sort_order;
  if (order === undefined || order === null) {
    const maxRow = await db.getOne<{ max_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM milestones WHERE project_id = $1",
      [id]
    );
    order = (maxRow?.max_order ?? -1) + 1;
  }

  const result = await db.query<Milestone>(
    `INSERT INTO milestones (project_id, title, description, target_date, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, title.trim(), description || null, target_date || null, order]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
});
