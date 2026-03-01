import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOne, query } from "@/lib/db";
import { withAuth } from "@/lib/api-handler";

/**
 * POST /api/org — Create a new organization (for onboarding, no org required)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has an org
  const existing = await getOne<{ org_id: string }>(
    "SELECT org_id FROM org_members WHERE user_id = $1",
    [session.user.id]
  );
  if (existing) {
    return NextResponse.json({ error: "You already belong to an organization" }, { status: 400 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  // Generate slug from name
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || `org-${Date.now()}`;

  // Check slug uniqueness
  const slugExists = await getOne<{ id: string }>(
    "SELECT id FROM organizations WHERE slug = $1",
    [slug]
  );

  const finalSlug = slugExists ? `${slug}-${Date.now()}` : slug;

  const result = await query<{ id: string; name: string; slug: string }>(
    `INSERT INTO organizations (name, slug)
     VALUES ($1, $2)
     RETURNING id, name, slug`,
    [name.trim(), finalSlug]
  );

  const org = result.rows[0];

  // Add the creator as admin
  await query(
    "INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')",
    [org.id, session.user.id]
  );

  return NextResponse.json(org, { status: 201 });
}

/**
 * GET /api/org — Get current org info
 */
export const GET = withAuth(async (_req, { db, orgId }) => {
  const org = await db.getOne<{ id: string; name: string; slug: string; created_at: string }>(
    "SELECT id, name, slug, created_at FROM organizations WHERE id = $1",
    [orgId]
  );
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  return NextResponse.json(org);
});

/**
 * PATCH /api/org — Update org info (admin only)
 */
export const PATCH = withAuth(async (req, { orgId }) => {
  const body = await req.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  const result = await query<{ id: string; name: string; slug: string }>(
    "UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug",
    [name.trim(), orgId]
  );

  return NextResponse.json(result.rows[0]);
}, { requireAdmin: true });
