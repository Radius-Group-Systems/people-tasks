import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ActionItem, Person } from "@/lib/types";
import { sendEmail, formatTaskEmail } from "@/lib/email";

/**
 * POST /api/email/send
 * Send a task to someone via email.
 * Body: { action_item_id: number }
 */
export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const { action_item_id, test, to, subject: testSubject, text: testText } = body;

  // Test mode: send a simple test email
  if (test && to) {
    try {
      const result = await sendEmail({
        to,
        subject: testSubject || "PeopleTasks Test",
        text: testText || "Test email from PeopleTasks",
      }, orgId);
      return NextResponse.json({ success: true, message_id: result.messageId });
    } catch (err) {
      console.error("Test email failed:", err);
      return NextResponse.json(
        { error: "Failed to send test email. Check your SMTP settings." },
        { status: 500 }
      );
    }
  }

  if (!action_item_id) {
    return NextResponse.json({ error: "action_item_id is required" }, { status: 400 });
  }

  // Load the action item with person info
  const item = await db.getOne<ActionItem & { person_email: string | null }>(
    `SELECT ai.*, p.email AS person_email, p.name AS person_name
     FROM action_items ai
     LEFT JOIN people p ON p.id = ai.person_id
     WHERE ai.id = $1`,
    [action_item_id]
  );

  if (!item) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  // Figure out who to email
  let recipientEmail = item.person_email;
  let recipientName = item.person_name;

  // If the task is owner_type=them but person_id points to the requester,
  // try source_person for the email
  if (!recipientEmail && item.source_person_id) {
    const source = await db.getOne<Person>(
      "SELECT * FROM people WHERE id = $1",
      [item.source_person_id]
    );
    if (source?.email) {
      recipientEmail = source.email;
      recipientName = source.name;
    }
  }

  if (!recipientEmail) {
    return NextResponse.json(
      { error: `No email address for ${recipientName || "this person"}. Add one in their profile.` },
      { status: 400 }
    );
  }

  // Get the sender's name
  const senderRow = await db.getOne<{ value: { from_name: string } }>(
    "SELECT value FROM settings WHERE key = 'email'"
  );
  const fromName = senderRow?.value?.from_name || "PeopleTasks";

  // Format and send
  const { subject, text, html } = formatTaskEmail(
    item.title,
    item.description,
    item.checklist || [],
    fromName,
  );

  try {
    const result = await sendEmail({
      to: `"${recipientName}" <${recipientEmail}>`,
      subject,
      text,
      html,
    }, orgId);

    // Update the action item with sent tracking
    await db.query(
      `UPDATE action_items SET sent_via = 'email', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [action_item_id]
    );

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      sent_to: recipientEmail,
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send email. Check your SMTP settings and recipient address." },
      { status: 500 }
    );
  }
});
