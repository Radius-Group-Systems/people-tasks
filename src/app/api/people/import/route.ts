import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { parseVCards, VCardContact } from "@/lib/vcard";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const PHOTO_DIR = join(process.cwd(), "public", "uploads", "photos");

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

export const POST = withAuth(async (req, { db, orgId }) => {
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
  const existing = await db.getMany<{ name: string }>("SELECT LOWER(name) as name FROM people");
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

    let photoUrl: string | null = null;

    // Save embedded photo if present
    if (contact.photoBase64) {
      try {
        await mkdir(PHOTO_DIR, { recursive: true });
        const ext = contact.photoMimeType?.includes("png") ? "png" : "jpg";
        const filename = `${Date.now()}-import-${imported}.${ext}`;
        const buffer = Buffer.from(contact.photoBase64, "base64");
        await writeFile(join(PHOTO_DIR, filename), buffer);
        photoUrl = `/uploads/photos/${filename}`;
      } catch { /* skip photo on error */ }
    }

    await db.query(
      `INSERT INTO people (name, email, phone, slack_handle, organization, photo_url, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        contact.name.trim(),
        contact.email || null,
        contact.phone || null,
        contact.slack_handle || null,
        contact.organization || null,
        photoUrl,
        orgId,
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
});
