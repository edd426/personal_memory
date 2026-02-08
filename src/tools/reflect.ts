import type { ProfileStorage } from "../storage/interface.js";

// Section headers in me.md that can receive new content
const SECTIONS = [
  "Identity",
  "Current Focus",
  "Interests & Passions",
  "Goals",
  "Learned Facts",
  "Pet Peeves",
  "Relationships",
] as const;

export type Section = (typeof SECTIONS)[number];

export function createReflect(storage: ProfileStorage) {
  return async function reflect(conversationSummary: string, userId?: string) {
    try {
      const exists = await storage.exists(userId);
      if (!exists) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `No profile found at ${storage.getLocation(userId)}\n\n` +
                "Please create a profile first by copying templates/me.md to ~/.claude/me.md",
            },
          ],
        };
      }

      const currentProfile = await storage.read(userId);

      return {
        content: [
          {
            type: "text" as const,
            text: buildReflectionPrompt(conversationSummary, currentProfile!),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error during reflection: ${message}`,
          },
        ],
      };
    }
  };
}

function buildReflectionPrompt(
  conversationSummary: string,
  currentProfile: string
): string {
  return `# Reflection Analysis

## Current Profile
\`\`\`markdown
${currentProfile}
\`\`\`

## Conversation Summary
${conversationSummary}

## Instructions

Based on the conversation summary above:

1. **Identify NEW facts** to add to the profile
2. **Identify STALE or OUTDATED items** that should be removed (e.g., completed projects, outdated information, things that are no longer true)

### For Proposed Additions:
- Identify which section it belongs to: ${SECTIONS.join(", ")}
- Phrase it concisely (1-2 sentences max)
- Check it doesn't duplicate existing content
- For the Relationships section, use format: **Name** (relationship_type): fact about them
  - Example relationship types: partner, family, friend, colleague, mentor

### For Proposed Removals:
- Quote the exact line to remove
- Explain why it's stale or outdated

**Format your proposals like this:**

### Proposed Additions

**Section: [section name]**
- [proposed content]

### Proposed Removals

**Line:** "[exact text of the line to remove]"
**Reason:** [why this should be removed]

---

After listing all proposals, ask the user to approve each one individually.
- For approved additions, use the \`save_to_profile\` tool
- For approved removals, use the \`remove_from_profile\` tool with the exact line content

If no changes are needed, say "No changes to your profile from this conversation."`;
}

const DEFAULT_TEMPLATE = `# Me

## Identity

## Current Focus

## Interests & Passions

## Goals

## Learned Facts

## Pet Peeves

## Relationships
`;

export function createSaveToProfile(storage: ProfileStorage) {
  return async function saveToProfile(
    section: Section,
    content: string,
    userId?: string
  ) {
    try {
      const exists = await storage.exists(userId);
      let profile: string;

      if (!exists) {
        profile = DEFAULT_TEMPLATE;
      } else {
        profile = (await storage.read(userId))!;
      }

      // Find the section and append content
      const sectionHeader = `## ${section}`;
      const sectionIndex = profile.indexOf(sectionHeader);

      if (sectionIndex === -1) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Section "${section}" not found in profile`,
            },
          ],
        };
      }

      // Find the next section (or end of file)
      const afterSection = profile.slice(sectionIndex + sectionHeader.length);
      const nextSectionMatch = afterSection.match(/\n## /);
      const insertPosition = nextSectionMatch
        ? sectionIndex + sectionHeader.length + nextSectionMatch.index!
        : profile.length;

      // Insert the new content before the next section
      const newContent = `\n- ${content}`;
      profile =
        profile.slice(0, insertPosition) +
        newContent +
        profile.slice(insertPosition);

      await storage.write(profile, userId);

      return {
        content: [
          {
            type: "text" as const,
            text: `Added to ${section}: "${content}"`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error saving to profile: ${message}`,
          },
        ],
      };
    }
  };
}

export function createRemoveFromProfile(storage: ProfileStorage) {
  return async function removeFromProfile(lineContent: string, userId?: string) {
    try {
      const exists = await storage.exists(userId);
      if (!exists) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No profile found at ${storage.getLocation(userId)}`,
            },
          ],
        };
      }

      let profile = (await storage.read(userId))!;

      // Try to find and remove the line (with bullet point prefix)
      const bulletLine = `- ${lineContent}`;
      let lineToRemove: string | null = null;

      // Check for exact match with bullet
      if (profile.includes(bulletLine)) {
        lineToRemove = bulletLine;
      }
      // Check for exact match without bullet (in case user provides with bullet)
      else if (profile.includes(lineContent)) {
        lineToRemove = lineContent;
      }

      if (!lineToRemove) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find line in profile: "${lineContent}"`,
            },
          ],
        };
      }

      // Remove the line and any trailing newline
      const lineWithNewline = lineToRemove + "\n";
      if (profile.includes(lineWithNewline)) {
        profile = profile.replace(lineWithNewline, "");
      } else {
        // Line might be at end of file without trailing newline
        profile = profile.replace(lineToRemove, "");
      }

      await storage.write(profile, userId);

      return {
        content: [
          {
            type: "text" as const,
            text: `Removed from profile: "${lineContent}"`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error removing from profile: ${message}`,
          },
        ],
      };
    }
  };
}
