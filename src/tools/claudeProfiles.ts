import type { ClaudeProfileStorage } from "../storage/claude-profile-interface.js";
import { validateModelId } from "../utils/model-id.js";

export function createListClaudeProfiles(storage: ClaudeProfileStorage) {
  return async function listClaudeProfiles(userId?: string) {
    try {
      const profiles = await storage.list(userId);

      if (profiles.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No Claude self-profiles found.",
            },
          ],
        };
      }

      const lines = profiles.map((p) => {
        const sizeKB = (p.size / 1024).toFixed(1);
        const date = p.lastModified.toISOString().split("T")[0];
        return `- **${p.modelId}** — ${sizeKB} KB, last modified ${date}`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `# Claude Self-Profiles\n\n` +
              `${profiles.length} profile(s) found:\n\n` +
              lines.join("\n"),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing Claude profiles: ${message}`,
          },
        ],
      };
    }
  };
}

export function createReadClaudeProfile(storage: ClaudeProfileStorage) {
  return async function readClaudeProfile(
    modelId: string,
    userId?: string
  ) {
    try {
      const sanitizedId = validateModelId(modelId);
      const content = await storage.read(sanitizedId, userId);

      if (!content) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Claude self-profile found for model "${sanitizedId}".`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text:
              `# Claude Self-Profile: ${sanitizedId}\n\n` +
              `---\n\n` +
              content,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading Claude profile: ${message}`,
          },
        ],
      };
    }
  };
}
