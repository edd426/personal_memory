/**
 * Storage interface for Claude self-profile operations.
 * Separate from ProfileStorage because Claude profiles are per-model
 * and need list() support.
 */

export interface ModelProfileInfo {
  modelId: string;
  size: number;
  lastModified: Date;
}

export interface ClaudeProfileStorage {
  /**
   * Read a Claude profile for a specific model.
   * @param modelId - Sanitized model identifier (e.g., "claude-opus-4-6")
   * @param userId - Optional user identifier for multi-tenant storage
   * @returns Profile content as string, or null if not found
   */
  read(modelId: string, userId?: string): Promise<string | null>;

  /**
   * Write a Claude profile for a specific model.
   * @param modelId - Sanitized model identifier
   * @param content - The profile content to write
   * @param userId - Optional user identifier for multi-tenant storage
   */
  write(modelId: string, content: string, userId?: string): Promise<void>;

  /**
   * Check if a Claude profile exists for a specific model.
   * @param modelId - Sanitized model identifier
   * @param userId - Optional user identifier for multi-tenant storage
   */
  exists(modelId: string, userId?: string): Promise<boolean>;

  /**
   * List all Claude profiles.
   * @param userId - Optional user identifier for multi-tenant storage
   * @returns Array of model profile info (modelId, size, lastModified)
   */
  list(userId?: string): Promise<ModelProfileInfo[]>;

  /**
   * Get the storage location description (for error messages).
   * @param modelId - Sanitized model identifier
   * @param userId - Optional user identifier for multi-tenant storage
   */
  getLocation(modelId: string, userId?: string): string;
}
