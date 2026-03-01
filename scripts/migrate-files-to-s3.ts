/**
 * One-time script to migrate existing local files in public/uploads/ to S3.
 * Updates database references from /uploads/... to /api/files/...
 *
 * Usage: npx tsx scripts/migrate-files-to-s3.ts
 *
 * Required env vars: S3_BUCKET, DATABASE_URL (or defaults)
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { Pool } from "pg";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".json": "application/json",
  ".txt": "text/plain", ".csv": "text/csv", ".md": "text/markdown",
};

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://ptasks:localdev@localhost:5433/people_tasks",
});

const s3 = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
});

const BUCKET = process.env.S3_BUCKET;
if (!BUCKET) {
  console.error("S3_BUCKET environment variable is required");
  process.exit(1);
}

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const UPLOADS_DIR = join(__dirname, "..", "public", "uploads");

async function uploadToS3(localPath: string, s3Key: string) {
  const body = readFileSync(localPath);
  const contentType = MIME_TYPES[extname(localPath).toLowerCase()] || "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: contentType,
    })
  );
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        files.push(...walkDir(full));
      } else {
        files.push(full);
      }
    }
  } catch {
    // Directory doesn't exist, that's fine
  }
  return files;
}

async function migrate() {
  console.log("Scanning local uploads...");
  const files = walkDir(UPLOADS_DIR);

  if (files.length === 0) {
    console.log("No local files found. Nothing to migrate.");
    await pool.end();
    return;
  }

  console.log(`Found ${files.length} files to migrate.`);

  let uploaded = 0;
  const urlMap = new Map<string, string>(); // old URL → new URL

  for (const localPath of files) {
    const relativePath = localPath.replace(join(__dirname, "..", "public"), "");
    const s3Key = `${DEFAULT_ORG_ID}/${relativePath.replace(/^\/uploads\//, "")}`;
    const newUrl = `/api/files/${s3Key}`;

    try {
      await uploadToS3(localPath, s3Key);
      urlMap.set(relativePath, newUrl);
      uploaded++;
      console.log(`  [${uploaded}/${files.length}] ${relativePath} → ${s3Key}`);
    } catch (err) {
      console.error(`  FAILED: ${relativePath}`, err);
    }
  }

  // Update database references
  console.log("\nUpdating database references...");

  // Update people.photo_url
  for (const [oldUrl, newUrl] of urlMap) {
    if (oldUrl.includes("/photos/")) {
      const result = await pool.query(
        "UPDATE people SET photo_url = $1 WHERE photo_url = $2",
        [newUrl, oldUrl]
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  Updated ${result.rowCount} photo references: ${oldUrl}`);
      }
    }
  }

  console.log(`\nMigration complete. ${uploaded}/${files.length} files uploaded to S3.`);
  console.log("You can now safely remove the public/uploads/ directory.");

  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
