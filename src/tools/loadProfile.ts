import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROFILE_PATH = join(homedir(), ".claude", "me.md");

export async function loadProfile() {
  try {
    if (!existsSync(PROFILE_PATH)) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `No profile found at ${PROFILE_PATH}\n\n` +
              "To create one, copy the template from templates/me.md to ~/.claude/me.md " +
              "and fill in your information.",
          },
        ],
      };
    }

    const content = await readFile(PROFILE_PATH, "utf-8");

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
}
