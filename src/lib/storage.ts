import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
});

const BUCKET = process.env.S3_BUCKET || "";

function requireBucket(): string {
  if (!BUCKET) throw new Error("S3_BUCKET environment variable is required");
  return BUCKET;
}

/**
 * Upload a file to S3. Returns the S3 key.
 * Key pattern: {orgId}/{type}/{filename}
 */
export async function uploadFile(
  orgId: string,
  type: string, // e.g. "photos", "uploads", "emails"
  filename: string,
  body: Buffer | Uint8Array,
  contentType?: string
): Promise<string> {
  const bucket = requireBucket();
  const key = `${orgId}/${type}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return key;
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(key: string): Promise<void> {
  const bucket = requireBucket();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Get a pre-signed URL for reading a file from S3.
 * Default expiry: 1 hour.
 */
export async function getFileUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const bucket = requireBucket();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Get the S3 object directly (for proxying to client).
 */
export async function getFile(key: string) {
  const bucket = requireBucket();
  return s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
