import { google } from "googleapis";
import { getOne, query, getMany } from "./db";

// Settings are stored in the settings table as key-value pairs (JSONB value)
// With multi-tenancy, settings are scoped by org_id
async function getSetting(key: string, orgId: string): Promise<string | null> {
  const row = await getOne<{ value: unknown }>(
    "SELECT value FROM settings WHERE key = $1 AND org_id = $2",
    [key, orgId]
  );
  if (!row?.value) return null;
  // The value column is JSONB; for calendar tokens we store a JSON string inside it
  return typeof row.value === "string" ? row.value : JSON.stringify(row.value);
}

async function setSetting(key: string, value: string, orgId: string) {
  // Parse to ensure valid JSON, then store as JSONB
  const jsonValue = JSON.parse(value);
  await query(
    `INSERT INTO settings (key, value, org_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, org_id) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(jsonValue), orgId]
  );
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/calendar/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
}

export async function handleCallback(code: string, orgId: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  await setSetting("google_calendar_tokens", JSON.stringify(tokens), orgId);
  return tokens;
}

export async function getAuthedClient(orgId: string) {
  const tokensStr = await getSetting("google_calendar_tokens", orgId);
  if (!tokensStr) return null;

  const client = getOAuth2Client();
  const tokens = JSON.parse(tokensStr);
  client.setCredentials(tokens);

  // Handle token refresh
  client.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await setSetting("google_calendar_tokens", JSON.stringify(merged), orgId);
  });

  return client;
}

export async function isCalendarConnected(orgId: string): Promise<boolean> {
  const tokensStr = await getSetting("google_calendar_tokens", orgId);
  return !!tokensStr;
}

export interface CalendarEvent {
  id: number;
  google_event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  attendees: { email: string; name?: string }[];
  encounter_id: number | null;
  synced_at: string;
  // Computed
  matched_people?: { person_id: number; person_name: string }[];
}

export async function syncCalendar(orgId: string) {
  const auth = await getAuthedClient(orgId);
  if (!auth) throw new Error("Google Calendar not connected");

  const calendar = google.calendar({ version: "v3", auth });

  // Fetch events from today-7d to today+14d
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 14);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  const events = response.data.items || [];
  let synced = 0;

  for (const event of events) {
    if (!event.id || !event.summary) continue;

    const attendees = (event.attendees || []).map((a) => ({
      email: a.email || "",
      name: a.displayName || "",
    }));

    await query(
      `INSERT INTO calendar_events (google_event_id, title, starts_at, ends_at, attendees, org_id, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (google_event_id) DO UPDATE SET
         title = $2, starts_at = $3, ends_at = $4, attendees = $5, synced_at = NOW()`,
      [
        event.id,
        event.summary,
        event.start?.dateTime || event.start?.date,
        event.end?.dateTime || event.end?.date,
        JSON.stringify(attendees),
        orgId,
      ]
    );
    synced++;
  }

  return { synced, total: events.length };
}

export async function getTodayEvents(orgId: string): Promise<CalendarEvent[]> {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const events = await getMany<CalendarEvent>(
    `SELECT * FROM calendar_events
     WHERE org_id = $3 AND starts_at >= $1 AND starts_at < $2
     ORDER BY starts_at`,
    [startOfDay.toISOString(), endOfDay.toISOString(), orgId]
  );

  // Match attendees to known people
  const people = await getMany<{ id: number; name: string; email: string }>(
    "SELECT id, name, email FROM people WHERE org_id = $1 AND email IS NOT NULL",
    [orgId]
  );
  const emailMap = new Map(
    people.map((p) => [
      p.email?.toLowerCase(),
      { person_id: p.id, person_name: p.name },
    ])
  );

  for (const event of events) {
    const attendees =
      typeof event.attendees === "string"
        ? JSON.parse(event.attendees)
        : event.attendees || [];
    event.matched_people = attendees
      .map((a: { email: string }) => emailMap.get(a.email?.toLowerCase()))
      .filter(Boolean) as { person_id: number; person_name: string }[];
  }

  return events;
}

export async function getUpcomingEvents(
  orgId: string,
  days: number = 7
): Promise<CalendarEvent[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  return getMany<CalendarEvent>(
    `SELECT * FROM calendar_events
     WHERE org_id = $3 AND starts_at >= $1 AND starts_at < $2
     ORDER BY starts_at`,
    [now.toISOString(), future.toISOString(), orgId]
  );
}
