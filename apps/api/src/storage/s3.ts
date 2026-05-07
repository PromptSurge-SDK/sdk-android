import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1', // MinIO ignores this but SDK requires it
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'promptsurge',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'promptsurge123',
      },
      forcePathStyle: true, // required for MinIO / non-AWS S3
    });
  }
  return _client;
}

const BUCKET = process.env.S3_BUCKET ?? 'promptsurge-uploads';
const PUBLIC_URL = process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/promptsurge-uploads';

/** Ensure the bucket exists (idempotent — creates on first call). */
export async function ensureBucket(): Promise<void> {
  const client = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/** Upload a buffer as a public image. Returns the public URL. */
export async function uploadImage(
  data: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `images/${randomUUID()}.${ext}`;
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: mimeType,
      ACL: 'public-read',
    }),
  );

  return `${PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}
