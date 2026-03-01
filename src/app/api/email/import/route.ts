import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { importEmails } from "@/lib/imap";

/**
 * POST /api/email/import
 * Poll Gmail for new emails in the configured label and import as encounters.
 */
export const POST = withAuth(async (req, { db, orgId }) => {
  try {
    const result = await importEmails(orgId, 20);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Email import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
});
