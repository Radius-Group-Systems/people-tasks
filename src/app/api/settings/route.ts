import { NextRequest, NextResponse } from "next/server";
import { getOne, query } from "@/lib/db";

export async function GET() {
  const row = await getOne<{ value: unknown }>(
    "SELECT value FROM settings WHERE key = 'email'"
  );

  // Mask the password in the response
  if (row?.value && typeof row.value === "object") {
    const settings = { ...(row.value as Record<string, unknown>) };
    if (settings.smtp_pass) settings.smtp_pass = "••••••••";
    if (settings.imap_pass) settings.imap_pass = "••••••••";
    return NextResponse.json({ email: settings });
  }

  return NextResponse.json({ email: null });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "Missing email settings" }, { status: 400 });
  }

  // If passwords are masked, merge with existing
  const existing = await getOne<{ value: Record<string, unknown> }>(
    "SELECT value FROM settings WHERE key = 'email'"
  );

  const settings = { ...email };
  if (existing?.value) {
    if (settings.smtp_pass === "••••••••") {
      settings.smtp_pass = existing.value.smtp_pass;
    }
    if (settings.imap_pass === "••••••••") {
      settings.imap_pass = existing.value.imap_pass;
    }
  }

  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('email', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify(settings)]
  );

  return NextResponse.json({ success: true });
}
