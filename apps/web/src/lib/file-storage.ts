import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type StoredPdf = {
  storageProvider: "r2" | "local";
  bucket: string;
  objectKey: string;
  localPath: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
};

let s3Client: S3Client | null = null;

export function fileStorageRoot() {
  return process.env.CVSCHOLAR_FILE_STORAGE_DIR || path.join(process.cwd(), "storage");
}

export function r2IsConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_PRIVATE_BUCKET
  );
}

export async function storeGeneratedPdf({
  bytes,
  workspaceId,
  documentId,
  filename
}: {
  bytes: Buffer;
  workspaceId: string;
  documentId: string;
  filename: string;
}): Promise<StoredPdf> {
  const checksumSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const objectKey = `workspaces/${workspaceId}/cv/${documentId}/${checksumSha256.slice(0, 16)}-${filename}`;

  if (r2IsConfigured()) {
    const bucket = process.env.R2_PRIVATE_BUCKET as string;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: "application/pdf",
        Metadata: {
          checksumSha256
        }
      })
    );

    return {
      storageProvider: "r2",
      bucket,
      objectKey,
      localPath: "",
      filename,
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      checksumSha256
    };
  }

  const localPath = path.join(fileStorageRoot(), "generated", workspaceId, "cv", documentId, filename);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);

  return {
    storageProvider: "local",
    bucket: "",
    objectKey: "",
    localPath,
    filename,
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    checksumSha256
  };
}

export async function storeImportPdf({
  bytes,
  workspaceId,
  filename
}: {
  bytes: Buffer;
  workspaceId: string;
  filename: string;
}): Promise<StoredPdf> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "old-cv.pdf";
  const checksumSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const objectKey = `workspaces/${workspaceId}/imports/${checksumSha256.slice(0, 16)}-${safeFilename}`;

  if (r2IsConfigured()) {
    const bucket = process.env.R2_PRIVATE_BUCKET as string;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: "application/pdf",
        Metadata: {
          checksumSha256,
          source: "old-cv-import"
        }
      })
    );

    return {
      storageProvider: "r2",
      bucket,
      objectKey,
      localPath: "",
      filename: safeFilename,
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      checksumSha256
    };
  }

  const localPath = path.join(fileStorageRoot(), "imports", workspaceId, `${checksumSha256.slice(0, 16)}-${safeFilename}`);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);

  return {
    storageProvider: "local",
    bucket: "",
    objectKey,
    localPath,
    filename: safeFilename,
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    checksumSha256
  };
}

export async function storeWorkspaceFile({
  bytes,
  workspaceId,
  filename,
  mimeType,
  prefix = "agent-attachments"
}: {
  bytes: Buffer;
  workspaceId: string;
  filename: string;
  mimeType: string;
  prefix?: string;
}): Promise<StoredPdf> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment";
  const checksumSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const objectKey = `workspaces/${workspaceId}/${prefix}/${checksumSha256.slice(0, 16)}-${safeFilename}`;

  if (r2IsConfigured()) {
    const bucket = process.env.R2_PRIVATE_BUCKET as string;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: mimeType || "application/octet-stream",
        Metadata: {
          checksumSha256,
          source: prefix
        }
      })
    );

    return {
      storageProvider: "r2",
      bucket,
      objectKey,
      localPath: "",
      filename: safeFilename,
      mimeType: mimeType || "application/octet-stream",
      byteSize: bytes.byteLength,
      checksumSha256
    };
  }

  const localPath = path.join(fileStorageRoot(), prefix, workspaceId, `${checksumSha256.slice(0, 16)}-${safeFilename}`);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);

  return {
    storageProvider: "local",
    bucket: "",
    objectKey,
    localPath,
    filename: safeFilename,
    mimeType: mimeType || "application/octet-stream",
    byteSize: bytes.byteLength,
    checksumSha256
  };
}

export async function readStoredAsset(asset: {
  storageProvider: string;
  bucket: string;
  objectKey: string;
  localPath: string;
}) {
  if (asset.storageProvider === "r2") {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: asset.bucket,
        Key: asset.objectKey
      })
    );

    if (!response.Body) {
      throw new Error("R2 object body is empty.");
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  if (!asset.localPath) {
    throw new Error("Local file path is missing.");
  }

  return readFile(asset.localPath);
}

function getR2Client() {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 is not configured.");
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  return s3Client;
}
