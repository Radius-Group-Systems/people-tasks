import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { isCalendarConnected } from "@/lib/calendar";

export const GET = withAuth(async (req, { db, orgId }) => {
  try {
    const connected = await isCalendarConnected(orgId);
    return NextResponse.json({ connected });
  } catch {
    // If GOOGLE_CLIENT_ID/SECRET aren't set, isCalendarConnected throws
    return NextResponse.json({ connected: false });
  }
});
