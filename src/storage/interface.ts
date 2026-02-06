/**
 * Storage interface for profile operations.
 * Allows swapping between local filesystem and cloud storage.
 */
export interface ProfileStorage {
  /**
   * Read the profile content.
   * @param userId - Optional user identifier for multi-tenant storage
   * @returns Profile content as string, or null if not found
   */
  read(userId?: string): Promise<string | null>;

  /**
   * Write profile content.
   * @param content - The profile content to write
   * @param userId - Optional user identifier for multi-tenant storage
   */
  write(content: string, userId?: string): Promise<void>;

  /**
   * Check if profile exists.
   * @param userId - Optional user identifier for multi-tenant storage
   */
  exists(userId?: string): Promise<boolean>;

  /**
   * Get the storage location description (for error messages).
   * @param userId - Optional user identifier for multi-tenant storage
   */
  getLocation(userId?: string): string;
}
