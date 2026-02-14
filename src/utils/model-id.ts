/**
 * Model ID sanitization and validation utilities.
 * Converts model names to filename-safe slugs.
 */

/**
 * Sanitize a model identifier into a filename-safe slug.
 * Examples:
 *   "Claude Opus 4.6" → "claude-opus-4-6"
 *   "claude-sonnet-4-5-20250929" → "claude-sonnet-4-5-20250929"
 */
export function sanitizeModelId(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validate that a model ID is non-empty after sanitization.
 * Returns the sanitized ID or throws.
 */
export function validateModelId(modelId: string): string {
  const sanitized = sanitizeModelId(modelId);
  if (!sanitized) {
    throw new Error(
      `Invalid model_id: "${modelId}" produces an empty slug after sanitization`
    );
  }
  return sanitized;
}
