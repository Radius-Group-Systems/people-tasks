import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { uploadFile, deleteFile } from "@/lib/storage";

export const POST = withAuth(async (req, { db, orgId }, params) => {
  const id = params!.id;

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const base64 = formData.get("base64") as string | null;
  const mimeType = formData.get("mimeType") as string | null;

  const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

  let buffer: Buffer;
  let ext: string;
  let contentType: string;

  if (file) {
    if (file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Photo too large. Maximum size is 5 MB." }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    buffer = Buffer.from(bytes);
    ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    contentType = file.type || "image/jpeg";
    if (!ALLOWED_PHOTO_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `File type .${ext} not allowed. Allowed: ${ALLOWED_PHOTO_EXTS.join(", ")}` },
        { status: 400 }
      );
    }
  } else if (base64) {
    buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Photo too large. Maximum size is 5 MB." }, { status: 400 });
    }
    ext = mimeType?.includes("png") ? "png" : mimeType?.includes("gif") ? "gif" : "jpg";
    contentType = mimeType || "image/jpeg";
  } else {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  // Delete old photo from S3 if exists
  const person = await db.getOne<{ photo_url: string | null }>(
    "SELECT photo_url FROM people WHERE id = $1",
    [id]
  );
  if (person?.photo_url?.startsWith("/api/files/")) {
    const oldKey = person.photo_url.replace("/api/files/", "");
    try { await deleteFile(oldKey); } catch { /* ignore */ }
  }

  const filename = `${Date.now()}-${id}.${ext}`;
  const key = await uploadFile(orgId, "photos", filename, buffer, contentType);
  const photoUrl = `/api/files/${key}`;

  await db.query("UPDATE people SET photo_url = $1, updated_at = NOW() WHERE id = $2", [photoUrl, id]);

  return NextResponse.json({ photo_url: photoUrl });
});

export const DELETE = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const person = await db.getOne<{ photo_url: string | null }>(
    "SELECT photo_url FROM people WHERE id = $1",
    [id]
  );

  if (person?.photo_url?.startsWith("/api/files/")) {
    const oldKey = person.photo_url.replace("/api/files/", "");
    try { await deleteFile(oldKey); } catch { /* ignore */ }
  }

  await db.query("UPDATE people SET photo_url = NULL, updated_at = NOW() WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
});
