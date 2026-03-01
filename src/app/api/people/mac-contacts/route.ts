import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface MacContact {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
}

// Strict allowlist: only letters, numbers, spaces, hyphens, apostrophes, periods
const SAFE_QUERY_RE = /^[a-zA-Z0-9 '\-.]+$/;
const MAX_QUERY_LENGTH = 100;

function buildJXA(searchQuery: string) {
  // JSON.stringify produces a safely escaped JS string literal
  const jsonSafe = JSON.stringify(searchQuery);
  return `
var app = Application("Contacts");
var query = ${jsonSafe}.toLowerCase();
var people = app.people.whose({_or: [
  {name: {_contains: ${jsonSafe}}},
  {organization: {_contains: ${jsonSafe}}}
]})();
var result = [];
for (var i = 0; i < Math.min(people.length, 25); i++) {
  var p = people[i];
  var name = p.name();
  if (!name) continue;
  var emails = p.emails();
  var phones = p.phones();
  result.push({
    name: name,
    organization: p.organization() || null,
    email: emails.length > 0 ? emails[0].value() : null,
    phone: phones.length > 0 ? phones[0].value() : null
  });
}
JSON.stringify(result);
`;
}

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  if (!SAFE_QUERY_RE.test(q)) {
    return NextResponse.json({ error: "Invalid characters in query" }, { status: 400 });
  }

  const scriptPath = join(tmpdir(), `people-tasks-contacts-${Date.now()}.js`);

  try {
    writeFileSync(scriptPath, buildJXA(q), "utf-8");

    // Use execFileSync with array args to avoid shell interpretation
    const output = execFileSync("osascript", ["-l", "JavaScript", scriptPath], {
      timeout: 15000,
      encoding: "utf-8",
    });

    const contacts: MacContact[] = JSON.parse(output.trim());
    contacts.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(contacts);
  } catch (err) {
    console.error("Failed to read Mac Contacts:", err);
    return NextResponse.json(
      { error: "Failed to search Mac Contacts." },
      { status: 500 }
    );
  } finally {
    try { unlinkSync(scriptPath); } catch { /* ignore */ }
  }
});
