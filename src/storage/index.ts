export type { ProfileStorage } from "./interface.js";
export { LocalProfileStorage } from "./local.js";
export { AzureBlobStorage } from "./azure-blob.js";

export type {
  ClaudeProfileStorage,
  ModelProfileInfo,
} from "./claude-profile-interface.js";
export { LocalClaudeProfileStorage } from "./claude-profile-local.js";
export { AzureBlobClaudeProfileStorage } from "./claude-profile-azure-blob.js";

import { LocalProfileStorage } from "./local.js";
import { AzureBlobStorage } from "./azure-blob.js";
import { LocalClaudeProfileStorage } from "./claude-profile-local.js";
import { AzureBlobClaudeProfileStorage } from "./claude-profile-azure-blob.js";
import type { ProfileStorage } from "./interface.js";
import type { ClaudeProfileStorage } from "./claude-profile-interface.js";

/**
 * Create the appropriate storage backend based on environment.
 *
 * Environment variables:
 * - AZURE_STORAGE_CONNECTION_STRING: Use Azure Blob Storage with connection string
 * - AZURE_STORAGE_ACCOUNT_URL: Use Azure Blob Storage with managed identity
 * - Neither: Use local file storage (fallback for development)
 */
export function createStorage(): ProfileStorage {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;

  if (connectionString) {
    return new AzureBlobStorage(connectionString);
  }

  if (accountUrl) {
    return new AzureBlobStorage(accountUrl);
  }

  // Default to local storage for Claude Code
  return new LocalProfileStorage();
}

/**
 * Create the appropriate Claude profile storage backend based on environment.
 * Uses the same environment detection as createStorage().
 */
export function createClaudeProfileStorage(): ClaudeProfileStorage {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;

  if (connectionString) {
    return new AzureBlobClaudeProfileStorage(connectionString);
  }

  if (accountUrl) {
    return new AzureBlobClaudeProfileStorage(accountUrl);
  }

  return new LocalClaudeProfileStorage();
}
