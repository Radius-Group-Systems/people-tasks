import { NextResponse } from "next/server";
import { importEmails } from "@/lib/imap";

/**
 * POST /api/email/import
 * Poll Gmail for new emails in the configured label and import as encounters.
 */
export async function POST() {
  try {
    const result = await importEmails(20);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Email import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
