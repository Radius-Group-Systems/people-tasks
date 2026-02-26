import { NextRequest, NextResponse } from "next/server";
import { query, getOne } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "photos");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const base64 = formData.get("base64") as string | null;
  const mimeType = formData.get("mimeType") as string | null;

  let buffer: Buffer;
  let ext: string;

  if (file) {
    const bytes = await file.arrayBuffer();
    buffer = Buffer.from(bytes);
    ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) ext = "jpg";
  } else if (base64) {
    buffer = Buffer.from(base64, "base64");
    ext = mimeType?.includes("png") ? "png" : mimeType?.includes("gif") ? "gif" : "jpg";
  } else {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Delete old photo if exists
  const person = await getOne<{ photo_url: string | null }>(
    "SELECT photo_url FROM people WHERE id = $1",
    [id]
  );
  if (person?.photo_url) {
    const oldPath = join(process.cwd(), "public", person.photo_url);
    try { await unlink(oldPath); } catch { /* ignore */ }
  }

  const filename = `${Date.now()}-${id}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  const photoUrl = `/uploads/photos/${filename}`;
  await query("UPDATE people SET photo_url = $1, updated_at = NOW() WHERE id = $2", [photoUrl, id]);

  return NextResponse.json({ photo_url: photoUrl });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const person = await getOne<{ photo_url: string | null }>(
    "SELECT photo_url FROM people WHERE id = $1",
    [id]
  );

  if (person?.photo_url) {
    const oldPath = join(process.cwd(), "public", person.photo_url);
    try { await unlink(oldPath); } catch { /* ignore */ }
  }

  await query("UPDATE people SET photo_url = NULL, updated_at = NOW() WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
