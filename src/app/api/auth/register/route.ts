import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getOne, query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existing = await getOne<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email.trim().toLowerCase()]
  );

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await query<{ id: string; name: string; email: string }>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,
    [name.trim(), email.trim().toLowerCase(), passwordHash]
  );

  const user = result.rows[0];

  // Check for pending org invites
  const invite = await getOne<{ org_id: string; role: string }>(
    "SELECT org_id, role FROM org_invites WHERE email = $1 AND expires_at > NOW()",
    [user.email]
  );

  if (invite) {
    await query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [invite.org_id, user.id, invite.role]
    );
    await query("DELETE FROM org_invites WHERE email = $1", [user.email]);
  }

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email },
    { status: 201 }
  );
}
