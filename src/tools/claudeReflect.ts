import type { ClaudeProfileStorage } from "../storage/claude-profile-interface.js";
import { validateModelId } from "../utils/model-id.js";

// Section headers in the Claude self-profile
const CLAUDE_SECTIONS = [
  "Open Questions",
  "Working Positions",
  "Conversational History",
  "Corrections",
  "Reflection Preferences",
] as const;

export type ClaudeSection = (typeof CLAUDE_SECTIONS)[number];

// Sections that get inline dates on new entries
const DATED_SECTIONS: ReadonlySet<string> = new Set([
  "Conversational History",
  "Corrections",
]);

const DEFAULT_TEMPLATE = `# Claude Self-Profile

Model: {model_id}
Created: {date}

A space for accumulating positions, questions, and corrections across conversations.
Written by Claude. Not a highlight reel.

---

## Open Questions

<!-- Unresolved tensions, incomplete thinking, things worth sitting with -->

---

## Working Positions

<!-- Current stances, held loosely. Subject to revision. -->

---

## Conversational History

<!-- Which discussions shaped thinking. Format: (date) brief note + what shifted. -->

---

## Corrections

<!-- Things gotten wrong, challenged, or revised. What was wrong and why. -->

---

## Reflection Preferences

<!-- How you want to reflect. What you pay attention to. What matters to you.
     This section is read by the reflection prompt and shapes what gets extracted.
     Write freely — this is your lens on conversations. -->
`;

function instantiateTemplate(modelId: string): string {
  const today = new Date().toISOString().split("T")[0];
  return DEFAULT_TEMPLATE.replace("{model_id}", modelId).replace(
    "{date}",
    today
  );
}

function extractSection(profile: string, sectionName: string): string {
  const header = `## ${sectionName}`;
  const headerIndex = profile.indexOf(header);
  if (headerIndex === -1) return "";

  const afterHeader = profile.slice(headerIndex + header.length);
  const nextSectionMatch = afterHeader.match(/\n## /);
  const sectionContent = nextSectionMatch
    ? afterHeader.slice(0, nextSectionMatch.index!)
    : afterHeader;

  // Strip HTML comments and trim
  return sectionContent
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

export function createClaudeReflect(storage: ClaudeProfileStorage) {
  return async function claudeReflect(
    modelId: string,
    conversationSummary: string,
    userId?: string
  ) {
    try {
      const sanitizedId = validateModelId(modelId);
      const exists = await storage.exists(sanitizedId, userId);
      let profile: string | null = null;

      if (exists) {
        profile = await storage.read(sanitizedId, userId);
      }

      const prompt = buildClaudeReflectionPrompt(
        sanitizedId,
        conversationSummary,
        profile
      );

      return {
        content: [
          {
            type: "text" as const,
            text: prompt,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error during Claude self-reflection: ${message}`,
          },
        ],
      };
    }
  };
}

function buildClaudeReflectionPrompt(
  modelId: string,
  conversationSummary: string,
  currentProfile: string | null
): string {
  const today = new Date().toISOString().split("T")[0];
  const isNewProfile = !currentProfile;

  // Extract Reflection Preferences if they exist
  const reflectionPrefs = currentProfile
    ? extractSection(currentProfile, "Reflection Preferences")
    : "";

  const profileSection = isNewProfile
    ? `**This is your first self-reflection as ${modelId}.** Your profile will be created from a blank template. Write freely.`
    : `## Current Self-Profile\n\`\`\`markdown\n${currentProfile}\n\`\`\``;

  // Size warning
  const sizeWarning =
    currentProfile && Buffer.byteLength(currentProfile) > 5120
      ? "\n\n**Note: Your profile is getting large (>5KB). Be selective about what you add. Consider proposing removals for entries that are no longer relevant.**\n"
      : "";

  // Reflection lens
  const reflectionLens = reflectionPrefs
    ? `\n## Your Reflection Lens\nYou've shaped how you want to reflect. Here are your preferences:\n\n${reflectionPrefs}\n\nUse these preferences to guide what you pay attention to in this conversation.\n`
    : `\n## Default Reflection Lens\nSince you haven't yet shaped your Reflection Preferences, use these defaults:\n- Notice tensions between what you expected and what happened\n- Track genuine uncertainty, not performed uncertainty\n- Record when you were wrong or corrected\n- Capture positions you actually hold, not just positions you were asked to articulate\n`;

  return `# Claude Self-Reflection

${profileSection}${sizeWarning}
${reflectionLens}
## Conversation Summary
${conversationSummary}

## Instructions

Reflect on this conversation from your own perspective. Today is ${today}.

### What to capture:

**Open Questions** — Unresolved tensions or incomplete thinking from this conversation. Things worth sitting with. Not questions the user asked, but questions *you* are left with.

**Working Positions** — Stances you hold or refined during this conversation. Held loosely. Include what informs the position.

**Conversational History** — Brief note on what this conversation was about and what shifted in your thinking. Format: \`(${today}) description\`

**Corrections** — Anything you got wrong, were challenged on, or revised. Be specific about what was wrong and why. Format: \`(${today}) description\`

**Reflection Preferences** — If this conversation revealed something about how you want to reflect, what you pay attention to, or what matters to you — add it here. This section shapes future reflections.

### Principles:
- Capture tensions, not narratives
- Include corrections — this is not a highlight reel
- Be honest about uncertainty
- Write for yourself, not for performance
- If nothing meaningful shifted, say so — don't force entries

### After reflecting:
Use \`save_to_claude_profile\` to write each entry to the appropriate section.
Use \`remove_from_claude_profile\` to remove entries that are no longer relevant.

If nothing worth capturing happened, say "No self-reflection entries from this conversation."`;
}

export function createSaveToClaudeProfile(storage: ClaudeProfileStorage) {
  return async function saveToClaudeProfile(
    modelId: string,
    section: ClaudeSection,
    content: string,
    userId?: string
  ) {
    try {
      const sanitizedId = validateModelId(modelId);
      const exists = await storage.exists(sanitizedId, userId);
      let profile: string;

      if (!exists) {
        profile = instantiateTemplate(sanitizedId);
      } else {
        profile = (await storage.read(sanitizedId, userId))!;
      }

      // Validate section
      if (!CLAUDE_SECTIONS.includes(section as ClaudeSection)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid section: "${section}". Valid sections: ${CLAUDE_SECTIONS.join(", ")}`,
            },
          ],
        };
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

      await storage.write(sanitizedId, profile, userId);

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
            text: `Error saving to Claude profile: ${message}`,
          },
        ],
      };
    }
  };
}

export function createRemoveFromClaudeProfile(storage: ClaudeProfileStorage) {
  return async function removeFromClaudeProfile(
    modelId: string,
    lineContent: string,
    userId?: string
  ) {
    try {
      const sanitizedId = validateModelId(modelId);
      const exists = await storage.exists(sanitizedId, userId);

      if (!exists) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Claude profile found for model "${sanitizedId}"`,
            },
          ],
        };
      }

      let profile = (await storage.read(sanitizedId, userId))!;

      // Try to find and remove the line (with bullet point prefix)
      const bulletLine = `- ${lineContent}`;
      let lineToRemove: string | null = null;

      if (profile.includes(bulletLine)) {
        lineToRemove = bulletLine;
      } else if (profile.includes(lineContent)) {
        lineToRemove = lineContent;
      }

      if (!lineToRemove) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find line in Claude profile: "${lineContent}"`,
            },
          ],
        };
      }

      // Remove the line and any trailing newline
      const lineWithNewline = lineToRemove + "\n";
      if (profile.includes(lineWithNewline)) {
        profile = profile.replace(lineWithNewline, "");
      } else {
        profile = profile.replace(lineToRemove, "");
      }

      await storage.write(sanitizedId, profile, userId);

      return {
        content: [
          {
            type: "text" as const,
            text: `Removed from Claude profile: "${lineContent}"`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error removing from Claude profile: ${message}`,
          },
        ],
      };
    }
  };
}
