import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import type { ProfileStorage } from "./interface.js";

const CONTAINER_NAME = "profiles";
const BLOB_NAME = "me.md";

/**
 * Azure Blob Storage backend for profiles.
 * Used for cloud deployment (Azure Functions).
 *
 * Storage path: profiles/{userId}/me.md
 */
export class AzureBlobStorage implements ProfileStorage {
  private containerClient: ContainerClient;

  constructor(connectionStringOrAccountUrl: string) {
    let blobServiceClient: BlobServiceClient;

    if (connectionStringOrAccountUrl.startsWith("https://")) {
      // Account URL - use DefaultAzureCredential (managed identity, env vars, etc.)
      blobServiceClient = new BlobServiceClient(
        connectionStringOrAccountUrl,
        new DefaultAzureCredential()
      );
    } else {
      // Connection string (for local development)
      blobServiceClient = BlobServiceClient.fromConnectionString(
        connectionStringOrAccountUrl
      );
    }

    this.containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  }

  private getBlobPath(userId?: string): string {
    if (!userId) {
      throw new Error("userId is required for Azure Blob Storage");
    }
    return `${userId}/${BLOB_NAME}`;
  }

  async read(userId?: string): Promise<string | null> {
    const blobPath = this.getBlobPath(userId);
    const blobClient = this.containerClient.getBlobClient(blobPath);

    try {
      const downloadResponse = await blobClient.download();
      const content = await streamToString(downloadResponse.readableStreamBody!);
      return content;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        (error as { statusCode: number }).statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async write(content: string, userId?: string): Promise<void> {
    const blobPath = this.getBlobPath(userId);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: {
        blobContentType: "text/markdown; charset=utf-8",
      },
    });
  }

  async exists(userId?: string): Promise<boolean> {
    const blobPath = this.getBlobPath(userId);
    const blobClient = this.containerClient.getBlobClient(blobPath);

    return await blobClient.exists();
  }

  getLocation(userId?: string): string {
    if (!userId) {
      return `Azure Blob Storage: ${CONTAINER_NAME}/[unknown user]/${BLOB_NAME}`;
    }
    return `Azure Blob Storage: ${CONTAINER_NAME}/${userId}/${BLOB_NAME}`;
  }
}

async function streamToString(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
