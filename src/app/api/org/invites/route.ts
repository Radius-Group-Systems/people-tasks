import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { query } from "@/lib/db";

/**
 * GET /api/org/invites — List pending invites
 */
export const GET = withAuth(async (_req, { orgId }) => {
  const result = await query<{
    id: string;
    email: string;
    role: string;
    invited_by: string;
    inviter_name: string;
    expires_at: string;
    created_at: string;
  }>(
    `SELECT oi.id, oi.email, oi.role, oi.invited_by, u.name AS inviter_name,
            oi.expires_at, oi.created_at
     FROM org_invites oi
     JOIN users u ON u.id = oi.invited_by
     WHERE oi.org_id = $1 AND oi.expires_at > NOW()
     ORDER BY oi.created_at DESC`,
    [orgId]
  );
  return NextResponse.json(result.rows);
}, { requireAdmin: true });

/**
 * POST /api/org/invites — Invite a user by email (admin only)
 * Body: { email: string, role?: string }
 */
export const POST = withAuth(async (req, { orgId, userId }) => {
  const body = await req.json();
  const { email, role = "member" } = body;

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Role must be 'admin' or 'member'" }, { status: 400 });
  }

  // Check if already a member
  const existingMember = await query(
    `SELECT om.user_id FROM org_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.org_id = $1 AND u.email = $2`,
    [orgId, email.trim().toLowerCase()]
  );
  if (existingMember.rows.length > 0) {
    return NextResponse.json({ error: "This person is already a member" }, { status: 409 });
  }

  const result = await query<{
    id: string;
    email: string;
    role: string;
    expires_at: string;
  }>(
    `INSERT INTO org_invites (org_id, email, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, email) DO UPDATE SET
       role = EXCLUDED.role,
       invited_by = EXCLUDED.invited_by,
       expires_at = NOW() + INTERVAL '7 days',
       created_at = NOW()
     RETURNING id, email, role, expires_at`,
    [orgId, email.trim().toLowerCase(), role, userId]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}, { requireAdmin: true });

/**
 * DELETE /api/org/invites — Cancel an invite (admin only)
 * Body: { invite_id: string }
 */
export const DELETE = withAuth(async (req, { orgId }) => {
  const body = await req.json();
  const { invite_id } = body;

  if (!invite_id) {
    return NextResponse.json({ error: "invite_id is required" }, { status: 400 });
  }

  await query(
    "DELETE FROM org_invites WHERE id = $1 AND org_id = $2",
    [invite_id, orgId]
  );

  return NextResponse.json({ success: true });
}, { requireAdmin: true });
