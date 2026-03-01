import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getOne, query } from "@/lib/db";

export const GET = withAuth(async (_req, { userId }) => {
  const user = await getOne<{
    phone: string | null;
    phone_verified: boolean;
    sms_notifications_enabled: boolean;
  }>(
    "SELECT phone, phone_verified, sms_notifications_enabled FROM users WHERE id = $1",
    [userId]
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    phone: user.phone,
    phone_verified: user.phone_verified,
    sms_notifications_enabled: user.sms_notifications_enabled,
  });
});

export const PUT = withAuth(async (req, { userId }) => {
  const body = await req.json();
  const { sms_notifications_enabled } = body;

  if (typeof sms_notifications_enabled !== "boolean") {
    return NextResponse.json({ error: "sms_notifications_enabled must be boolean" }, { status: 400 });
  }

  // Only allow enabling if phone is verified
  if (sms_notifications_enabled) {
    const user = await getOne<{ phone_verified: boolean }>(
      "SELECT phone_verified FROM users WHERE id = $1",
      [userId]
    );
    if (!user?.phone_verified) {
      return NextResponse.json(
        { error: "Verify your phone number first" },
        { status: 400 }
      );
    }
  }

  await query(
    "UPDATE users SET sms_notifications_enabled = $1 WHERE id = $2",
    [sms_notifications_enabled, userId]
  );

  return NextResponse.json({ sms_notifications_enabled });
});
