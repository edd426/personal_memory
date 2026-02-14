import type { ProfileStorage } from "../storage/interface.js";
import type { ClaudeProfileStorage } from "../storage/claude-profile-interface.js";
import { validateModelId } from "../utils/model-id.js";

export function createLoadProfile(
  storage: ProfileStorage,
  claudeStorage?: ClaudeProfileStorage
) {
  return async function loadProfile(userId?: string, modelId?: string) {
    try {
      // Load user profile
      const userExists = await storage.exists(userId);
      let userSection: string;

      if (!userExists) {
        userSection =
          `No profile found at ${storage.getLocation(userId)}\n\n` +
          "To create one, use /reflect to build your profile over time, " +
          "or use the template in templates/me.md as a starting point.";
      } else {
        const content = await storage.read(userId);
        userSection =
          "# Personal Profile Loaded\n\n" +
          "The following profile has been loaded into context:\n\n" +
          "---\n\n" +
          content;
      }

      // If no model_id provided or no claude storage, return only user profile (backward compat)
      if (!modelId || !claudeStorage) {
        return {
          content: [
            {
              type: "text" as const,
              text: userSection,
            },
          ],
        };
      }

      // Load Claude self-profile
      let claudeSection: string;
      try {
        const sanitizedId = validateModelId(modelId);
        const claudeExists = await claudeStorage.exists(sanitizedId, userId);

        if (!claudeExists) {
          claudeSection =
            `No Claude self-profile found for '${sanitizedId}'. ` +
            `It will be created when you first self-reflect.`;
        } else {
          const claudeContent = await claudeStorage.read(sanitizedId, userId);
          claudeSection =
            `# Claude Self-Profile Loaded (${sanitizedId})\n\n` +
            "---\n\n" +
            claudeContent;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        claudeSection = `Error loading Claude self-profile: ${message}`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: userSection + "\n\n---\n\n" + claudeSection,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error loading profile: ${message}`,
          },
        ],
      };
    }
  };
}
