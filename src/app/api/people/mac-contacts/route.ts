import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface MacContact {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
}

function buildJXA(searchQuery: string) {
  const escaped = searchQuery.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `
var app = Application("Contacts");
var query = "${escaped}".toLowerCase();
var people = app.people.whose({_or: [
  {name: {_contains: "${escaped}"}},
  {organization: {_contains: "${escaped}"}}
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const scriptPath = join(tmpdir(), "people-tasks-contacts.js");

  try {
    writeFileSync(scriptPath, buildJXA(q), "utf-8");

    const output = execSync(`osascript -l JavaScript "${scriptPath}"`, {
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
}
