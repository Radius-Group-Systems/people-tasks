import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getTodayEvents, getUpcomingEvents } from "@/lib/calendar";

export const GET = withAuth(async (req, { db, orgId }) => {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "today";

  try {
    if (view === "today") {
      const events = await getTodayEvents(orgId);
      return NextResponse.json(events);
    } else {
      const days = Math.min(Math.max(parseInt(searchParams.get("days") || "7") || 7, 1), 90);
      const events = await getUpcomingEvents(orgId, days);
      return NextResponse.json(events);
    }
  } catch (err) {
    console.error("Calendar fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events." },
      { status: 500 }
    );
  }
});
