import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import crypto from "crypto";

const sns = new SNSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

/**
 * Send an SMS message via AWS SNS.
 */
export async function sendSms(phone: string, message: string): Promise<string> {
  const result = await sns.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
      },
    })
  );

  return result.MessageId || "";
}

/**
 * Format an action item into a concise SMS message (<160 chars).
 */
export function formatTaskSms(
  title: string,
  personName?: string | null,
  dueInfo?: string | null
): string {
  const parts: string[] = [];

  if (personName) {
    parts.push(`From ${personName}:`);
  }

  parts.push(title);

  if (dueInfo) {
    parts.push(`Due: ${dueInfo}`);
  }

  parts.push("- PeopleTasks");

  let msg = parts.join(" ");
  if (msg.length > 160) {
    msg = msg.slice(0, 157) + "...";
  }
  return msg;
}

/**
 * Generate a 6-digit verification code.
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 */
export function normalizePhone(phone: string): string {
  // Strip all non-digit characters except leading +
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (hasPlus && digits.length >= 11) {
    return "+" + digits;
  }

  // US number: 10 digits → +1XXXXXXXXXX
  if (digits.length === 10) {
    return "+1" + digits;
  }

  // Already has country code (11+ digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }

  // Return with + prefix for international
  if (digits.length > 10) {
    return "+" + digits;
  }

  // Can't normalize — return as-is with +
  return "+" + digits;
}
