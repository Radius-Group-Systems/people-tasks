import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getAuthUrl } from "@/lib/calendar";

export const GET = withAuth(async (req, { db, orgId }) => {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Calendar not configured",
      },
      { status: 500 }
    );
  }
});
