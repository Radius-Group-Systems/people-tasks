import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile } from "@/lib/storage";

/**
 * GET /api/files/{orgId}/{type}/{filename}
 * Auth-gated proxy to serve S3 files. Validates the orgId matches the user's org.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  // Ensure the file belongs to the user's org
  if (!key.startsWith(session.user.orgId + "/")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const response = await getFile(key);
    const byteArray = await response.Body?.transformToByteArray();

    if (!byteArray) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(byteArray), {
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("File fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
