import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getOne, query } from "@/lib/db";

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const user = await getOne<{
    phone_verification_code: string | null;
    phone_verification_expires: string | null;
  }>(
    "SELECT phone_verification_code, phone_verification_expires FROM users WHERE id = $1",
    [userId]
  );

  if (!user || !user.phone_verification_code) {
    return NextResponse.json({ error: "No pending verification" }, { status: 400 });
  }

  if (new Date(user.phone_verification_expires!) < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (user.phone_verification_code !== code.trim()) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await query(
    `UPDATE users
     SET phone_verified = true, phone_verification_code = NULL, phone_verification_expires = NULL
     WHERE id = $1`,
    [userId]
  );

  return NextResponse.json({ verified: true });
});
