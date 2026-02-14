import {
  BlobServiceClient,
  ContainerClient,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import type {
  ClaudeProfileStorage,
  ModelProfileInfo,
} from "./claude-profile-interface.js";

const CONTAINER_NAME = "profiles";
const CLAUDE_PREFIX = "claude";

/**
 * Azure Blob Storage backend for Claude self-profiles.
 * Storage path: profiles/{userId}/claude/{modelId}.md
 *
 * Reuses the same container and connection approach as AzureBlobStorage.
 */
export class AzureBlobClaudeProfileStorage implements ClaudeProfileStorage {
  private containerClient: ContainerClient;

  constructor(connectionStringOrAccountUrl: string) {
    let blobServiceClient: BlobServiceClient;

    if (connectionStringOrAccountUrl.startsWith("https://")) {
      blobServiceClient = new BlobServiceClient(
        connectionStringOrAccountUrl,
        new DefaultAzureCredential()
      );
    } else {
      blobServiceClient = BlobServiceClient.fromConnectionString(
        connectionStringOrAccountUrl
      );
    }

    this.containerClient =
      blobServiceClient.getContainerClient(CONTAINER_NAME);
  }

  private getBlobPath(modelId: string, userId?: string): string {
    if (!userId) {
      throw new Error("userId is required for Azure Blob Storage");
    }
    return `${userId}/${CLAUDE_PREFIX}/${modelId}.md`;
  }

  private getPrefix(userId?: string): string {
    if (!userId) {
      throw new Error("userId is required for Azure Blob Storage");
    }
    return `${userId}/${CLAUDE_PREFIX}/`;
  }

  async read(modelId: string, userId?: string): Promise<string | null> {
    const blobPath = this.getBlobPath(modelId, userId);
    const blobClient = this.containerClient.getBlobClient(blobPath);

    try {
      const downloadResponse = await blobClient.download();
      return await streamToString(downloadResponse.readableStreamBody!);
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

  async write(
    modelId: string,
    content: string,
    userId?: string
  ): Promise<void> {
    const blobPath = this.getBlobPath(modelId, userId);
    const blockBlobClient =
      this.containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: {
        blobContentType: "text/markdown; charset=utf-8",
      },
    });
  }

  async exists(modelId: string, userId?: string): Promise<boolean> {
    const blobPath = this.getBlobPath(modelId, userId);
    const blobClient = this.containerClient.getBlobClient(blobPath);
    return await blobClient.exists();
  }

  async list(userId?: string): Promise<ModelProfileInfo[]> {
    const prefix = this.getPrefix(userId);
    const profiles: ModelProfileInfo[] = [];

    for await (const blob of this.containerClient.listBlobsFlat({
      prefix,
      includeMetadata: true,
    })) {
      // Extract modelId from path: {userId}/claude/{modelId}.md
      const filename = blob.name.slice(prefix.length);
      if (!filename.endsWith(".md")) continue;
      const modelId = filename.slice(0, -3);

      profiles.push({
        modelId,
        size: blob.properties.contentLength ?? 0,
        lastModified: blob.properties.lastModified ?? new Date(0),
      });
    }

    return profiles;
  }

  getLocation(modelId: string, userId?: string): string {
    if (!userId) {
      return `Azure Blob Storage: ${CONTAINER_NAME}/[unknown user]/${CLAUDE_PREFIX}/${modelId}.md`;
    }
    return `Azure Blob Storage: ${CONTAINER_NAME}/${userId}/${CLAUDE_PREFIX}/${modelId}.md`;
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
