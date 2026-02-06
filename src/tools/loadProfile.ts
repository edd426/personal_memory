import type { ProfileStorage } from "../storage/interface.js";

export function createLoadProfile(storage: ProfileStorage) {
  return async function loadProfile(userId?: string) {
    try {
      const exists = await storage.exists(userId);
      if (!exists) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `No profile found at ${storage.getLocation(userId)}\n\n` +
                "To create one, copy the template from templates/me.md to ~/.claude/me.md " +
                "and fill in your information.",
            },
          ],
        };
      }

      const content = await storage.read(userId);

      return {
        content: [
          {
            type: "text" as const,
            text:
              "# Personal Profile Loaded\n\n" +
              "The following profile has been loaded into context:\n\n" +
              "---\n\n" +
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
            text: `Error loading profile: ${message}`,
          },
        ],
      };
    }
  };
}
