import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Milestone } from "@/lib/types";

export const PATCH = withAuth(async (req, { db }, params) => {
  const milestoneId = params!.milestoneId;
  const body = await req.json();

  const existing = await db.getOne<Milestone>(
    "SELECT * FROM milestones WHERE id = $1",
    [milestoneId]
  );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await db.query<Milestone>(
    `UPDATE milestones SET
      title = $2,
      description = $3,
      target_date = $4,
      status = $5,
      sort_order = $6
    WHERE id = $1
    RETURNING *`,
    [
      milestoneId,
      body.title !== undefined ? body.title : existing.title,
      body.description !== undefined ? body.description : existing.description,
      body.target_date !== undefined ? body.target_date : existing.target_date,
      body.status !== undefined ? body.status : existing.status,
      body.sort_order !== undefined ? body.sort_order : existing.sort_order,
    ]
  );

  return NextResponse.json(result.rows[0]);
});

export const DELETE = withAuth(async (_req, { db }, params) => {
  const milestoneId = params!.milestoneId;

  // Unlink tasks from this milestone (don't remove from project)
  await db.query(
    "UPDATE action_items SET milestone_id = NULL WHERE milestone_id = $1",
    [milestoneId]
  );

  await db.query("DELETE FROM milestones WHERE id = $1", [milestoneId]);

  return NextResponse.json({ success: true });
});
