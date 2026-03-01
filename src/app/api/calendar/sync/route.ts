import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { syncCalendar } from "@/lib/calendar";

export const POST = withAuth(async (req, { db, orgId }) => {
  try {
    const result = await syncCalendar(orgId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
});
