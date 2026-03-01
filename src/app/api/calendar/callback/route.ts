import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { handleCallback } from "@/lib/calendar";

export const GET = withAuth(async (req, { db, orgId }) => {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    await handleCallback(code, orgId);
    return NextResponse.redirect(new URL("/settings", req.url));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth failed" },
      { status: 500 }
    );
  }
});
