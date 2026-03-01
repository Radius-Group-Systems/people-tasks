import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { sendSms, generateVerificationCode, normalizePhone } from "@/lib/sms";
import { query } from "@/lib/db";

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json();
  const { phone } = body;

  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  const code = generateVerificationCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store verification code on user record
  await query(
    `UPDATE users
     SET phone = $1, phone_verification_code = $2, phone_verification_expires = $3, phone_verified = false
     WHERE id = $4`,
    [normalized, code, expires.toISOString(), userId]
  );

  try {
    await sendSms(normalized, `Your PeopleTasks verification code is: ${code}`);
    return NextResponse.json({ sent: true, phone: normalized });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send SMS" },
      { status: 500 }
    );
  }
});
