import { NextRequest, NextResponse } from "next/server";
import { query, getMany } from "@/lib/db";
import { sendSms, formatTaskSms } from "@/lib/sms";

/**
 * Cron endpoint for processing scheduled SMS notifications.
 * Protected by CRON_SECRET header — not user-authenticated.
 * Runs every 15 minutes via EventBridge.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let totalSent = 0;

  // Find all users with SMS enabled and verified
  const users = await getMany<{
    id: string;
    phone: string;
    org_id: string;
  }>(
    `SELECT u.id, u.phone, om.org_id
     FROM users u
     JOIN org_members om ON om.user_id = u.id
     WHERE u.sms_notifications_enabled = true
       AND u.phone_verified = true
       AND u.phone IS NOT NULL`
  );

  for (const user of users) {
    // 1. Due within 1 hour or overdue action items
    const dueItems = await getMany<{
      id: number;
      title: string;
      due_at: string;
      source_person_name: string | null;
    }>(
      `SELECT ai.id, ai.title, ai.due_at, sp.name AS source_person_name
       FROM action_items ai
       LEFT JOIN people sp ON sp.id = ai.source_person_id
       WHERE ai.org_id = $1
         AND ai.status IN ('open', 'in_progress')
         AND ai.due_at IS NOT NULL
         AND ai.due_at <= NOW() + INTERVAL '1 hour'
         AND NOT EXISTS (
           SELECT 1 FROM notification_log nl
           WHERE nl.user_id = $2
             AND nl.action_item_id = ai.id
             AND nl.notification_type IN ('due_reminder', 'overdue')
             AND nl.sent_at > NOW() - INTERVAL '24 hours'
         )`,
      [user.org_id, user.id]
    );

    for (const item of dueItems) {
      const isOverdue = new Date(item.due_at) < new Date();
      const notifType = isOverdue ? "overdue" : "due_reminder";
      const dueInfo = isOverdue
        ? `OVERDUE (${new Date(item.due_at).toLocaleDateString()})`
        : new Date(item.due_at).toLocaleDateString();

      try {
        const message = formatTaskSms(item.title, item.source_person_name, dueInfo);
        await sendSms(user.phone, message);

        await query(
          `INSERT INTO notification_log (org_id, user_id, action_item_id, notification_type, channel)
           VALUES ($1, $2, $3, $4, 'sms')`,
          [user.org_id, user.id, item.id, notifType]
        );
        totalSent++;
      } catch (err) {
        console.error(`Failed to send SMS to ${user.phone} for item ${item.id}:`, err);
      }
    }

    // 2. Follow-up reminders: encounters from last 48 hours with unresolved action items
    const followUpItems = await getMany<{
      id: number;
      title: string;
      encounter_title: string;
      source_person_name: string | null;
    }>(
      `SELECT ai.id, ai.title, e.title AS encounter_title, sp.name AS source_person_name
       FROM action_items ai
       JOIN encounters e ON e.id = ai.encounter_id
       LEFT JOIN people sp ON sp.id = ai.source_person_id
       WHERE ai.org_id = $1
         AND ai.status IN ('open', 'in_progress')
         AND e.occurred_at > NOW() - INTERVAL '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM notification_log nl
           WHERE nl.user_id = $2
             AND nl.action_item_id = ai.id
             AND nl.notification_type = 'follow_up'
             AND nl.sent_at > NOW() - INTERVAL '24 hours'
         )`,
      [user.org_id, user.id]
    );

    for (const item of followUpItems) {
      try {
        const message = formatTaskSms(
          item.title,
          item.source_person_name,
          `Follow-up from: ${item.encounter_title}`
        );
        await sendSms(user.phone, message);

        await query(
          `INSERT INTO notification_log (org_id, user_id, action_item_id, notification_type, channel)
           VALUES ($1, $2, $3, 'follow_up', 'sms')`,
          [user.org_id, user.id, item.id]
        );
        totalSent++;
      } catch (err) {
        console.error(`Failed to send follow-up SMS for item ${item.id}:`, err);
      }
    }
  }

  return NextResponse.json({ processed: users.length, sent: totalSent });
}
