import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { query } from "@/lib/db";

/**
 * GET /api/org/members — List all members of the current org
 */
export const GET = withAuth(async (_req, { orgId }) => {
  const result = await query<{
    user_id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    created_at: string;
  }>(
    `SELECT om.user_id, u.name, u.email, u.image, om.role, om.created_at
     FROM org_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.org_id = $1
     ORDER BY om.created_at`,
    [orgId]
  );
  return NextResponse.json(result.rows);
});

/**
 * DELETE /api/org/members — Remove a member (admin only)
 * Body: { user_id: string }
 */
export const DELETE = withAuth(async (req, { orgId, userId }) => {
  const body = await req.json();
  const { user_id: targetUserId } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (targetUserId === userId) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await query(
    "DELETE FROM org_members WHERE org_id = $1 AND user_id = $2",
    [orgId, targetUserId]
  );

  return NextResponse.json({ success: true });
}, { requireAdmin: true });
