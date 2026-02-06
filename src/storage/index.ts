export type { ProfileStorage } from "./interface.js";
export { LocalProfileStorage } from "./local.js";
export { AzureBlobStorage } from "./azure-blob.js";

import { LocalProfileStorage } from "./local.js";
import { AzureBlobStorage } from "./azure-blob.js";
import type { ProfileStorage } from "./interface.js";

/**
 * Create the appropriate storage backend based on environment.
 *
 * Environment variables:
 * - AZURE_STORAGE_CONNECTION_STRING: Use Azure Blob Storage with connection string
 * - AZURE_STORAGE_ACCOUNT_URL: Use Azure Blob Storage with managed identity
 * - Neither: Use local file storage (~/.claude/me.md)
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
