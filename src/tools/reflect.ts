import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

const PROFILE_PATH = join(homedir(), ".claude", "me.md");

// Section headers in me.md that can receive new content
const SECTIONS = [
  "Identity",
  "Current Focus",
  "Interests & Passions",
  "Goals",
  "Learned Facts",
  "Pet Peeves",
] as const;

type Section = (typeof SECTIONS)[number];

interface ProposedAddition {
  section: Section;
  content: string;
}

export async function reflect(conversationSummary: string) {
  try {
    // Check if profile exists
    if (!existsSync(PROFILE_PATH)) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `No profile found at ${PROFILE_PATH}\n\n` +
              "Please create a profile first by copying templates/me.md to ~/.claude/me.md",
          },
        ],
      };
    }

    const currentProfile = await readFile(PROFILE_PATH, "utf-8");

    // Return instructions for Claude to analyze and propose additions
    // The actual extraction happens in the Claude session, not here
    return {
      content: [
        {
          type: "text" as const,
          text: buildReflectionPrompt(conversationSummary, currentProfile),
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

Based on the conversation summary above, identify any NEW facts, preferences, or information about the user that should be added to their profile.

For each proposed addition:
1. Identify which section it belongs to: ${SECTIONS.join(", ")}
2. Phrase it concisely (1-2 sentences max)
3. Check it doesn't duplicate existing content

**Format your proposals like this:**

### Proposed Additions

**Section: [section name]**
- [proposed content]

**Section: [section name]**
- [proposed content]

---

After listing proposals, ask the user to approve each one. For approved items, use the \`save_to_profile\` tool to save them.

If no new information was learned, say "No new information to add to your profile from this conversation."`;
}

// Additional tool for saving approved additions
export async function saveToProfile(section: Section, content: string) {
  try {
    if (!existsSync(PROFILE_PATH)) {
      // Create directory and file if needed
      await mkdir(dirname(PROFILE_PATH), { recursive: true });
      // Copy template structure
      const template = `# Me

## Identity

## Current Focus

## Interests & Passions

## Goals

## Learned Facts

## Pet Peeves
`;
      await writeFile(PROFILE_PATH, template, "utf-8");
    }

    let profile = await readFile(PROFILE_PATH, "utf-8");

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
    const afterSection = profile.slice(
      sectionIndex + sectionHeader.length
    );
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

    await writeFile(PROFILE_PATH, profile, "utf-8");

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
}
