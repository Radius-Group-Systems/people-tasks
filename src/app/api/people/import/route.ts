import { NextRequest, NextResponse } from "next/server";
import { query, getMany } from "@/lib/db";
import { parseVCards, VCardContact } from "@/lib/vcard";

interface ImportContact extends VCardContact {
  slack_handle?: string | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  names: string[];
  contacts?: ImportContact[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contacts, vcf, dryRun } = body as {
    contacts?: ImportContact[];
    vcf?: string;
    dryRun?: boolean;
  };

  let toImport: ImportContact[] = [];

  if (vcf) {
    toImport = parseVCards(vcf);
  } else if (contacts) {
    toImport = contacts;
  } else {
    return NextResponse.json({ error: "Provide contacts or vcf" }, { status: 400 });
  }

  // Dry run: just parse and return contacts for review
  if (dryRun) {
    return NextResponse.json({
      contacts: toImport.filter((c) => c.name?.trim()),
      total: toImport.length,
    });
  }

  // Get existing people to avoid duplicates (match on name, case-insensitive)
  const existing = await getMany<{ name: string }>("SELECT LOWER(name) as name FROM people");
  const existingNames = new Set(existing.map((p) => p.name));

  let imported = 0;
  let skipped = 0;
  const names: string[] = [];

  for (const contact of toImport) {
    if (!contact.name?.trim()) {
      skipped++;
      continue;
    }

    if (existingNames.has(contact.name.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    await query(
      `INSERT INTO people (name, email, phone, slack_handle, organization)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        contact.name.trim(),
        contact.email || null,
        contact.phone || null,
        contact.slack_handle || null,
        contact.organization || null,
      ]
    );

    existingNames.add(contact.name.toLowerCase().trim());
    names.push(contact.name.trim());
    imported++;
  }

  const result: ImportResult = {
    imported,
    skipped,
    total: toImport.length,
    names,
  };

  return NextResponse.json(result);
}
