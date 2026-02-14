#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createStorage, createClaudeProfileStorage } from "./storage/index.js";
import { createLoadProfile } from "./tools/loadProfile.js";
import {
  createReflect,
  createSaveToProfile,
  createRemoveFromProfile,
  type Section,
} from "./tools/reflect.js";
import {
  createClaudeReflect,
  createSaveToClaudeProfile,
  createRemoveFromClaudeProfile,
  type ClaudeSection,
} from "./tools/claudeReflect.js";
import {
  createListClaudeProfiles,
  createReadClaudeProfile,
} from "./tools/claudeProfiles.js";

// Initialize storage and tools
const storage = createStorage();
const claudeStorage = createClaudeProfileStorage();
const userId = process.env.PERSONAL_MEMORY_USER_ID;

const loadProfile = createLoadProfile(storage, claudeStorage);
const reflect = createReflect(storage);
const saveToProfile = createSaveToProfile(storage);
const removeFromProfile = createRemoveFromProfile(storage);
const claudeReflect = createClaudeReflect(claudeStorage);
const saveToClaudeProfile = createSaveToClaudeProfile(claudeStorage);
const removeFromClaudeProfile = createRemoveFromClaudeProfile(claudeStorage);
const listClaudeProfiles = createListClaudeProfiles(claudeStorage);
const readClaudeProfile = createReadClaudeProfile(claudeStorage);

const server = new Server(
  {
    name: "personal-memory",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "load_profile",
        description:
          "Load your personal profile (me.md) and Claude's self-profile into the current session context. " +
          "Always provide your model_id (e.g., 'claude-opus-4-6') so your self-profile is loaded alongside the user's.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: {
              type: "string",
              description:
                "Your model identifier (e.g., 'claude-opus-4-6', 'claude-sonnet-4-5-20250929'). " +
                "Always provide this so your self-profile loads alongside the user's profile.",
            },
          },
          required: [],
        },
      },
      {
        name: "reflect",
        description:
          "Analyze the current conversation and propose new facts to add to your " +
          "personal profile. Each proposed addition will be shown for your approval " +
          "before being saved to me.md.",
        inputSchema: {
          type: "object" as const,
          properties: {
            conversation_summary: {
              type: "string",
              description:
                "A summary of the current conversation to analyze for new learnings",
            },
          },
          required: ["conversation_summary"],
        },
      },
      {
        name: "save_to_profile",
        description:
          "Save an approved fact or preference to a specific section of the profile. " +
          "Use this after the user approves a proposed addition from reflect.",
        inputSchema: {
          type: "object" as const,
          properties: {
            section: {
              type: "string",
              enum: [
                "Identity",
                "Current Focus",
                "Interests & Passions",
                "Goals",
                "Learned Facts",
                "Pet Peeves",
                "Relationships",
              ],
              description: "The profile section to add the content to",
            },
            content: {
              type: "string",
              description: "The content to add (will be formatted as a bullet point)",
            },
          },
          required: ["section", "content"],
        },
      },
      {
        name: "remove_from_profile",
        description:
          "Remove a stale or outdated item from the profile. " +
          "Use this after the user approves a proposed removal from reflect.",
        inputSchema: {
          type: "object" as const,
          properties: {
            line_content: {
              type: "string",
              description:
                "The exact content of the line to remove (without the leading '- ' bullet point)",
            },
          },
          required: ["line_content"],
        },
      },
      {
        name: "claude_reflect",
        description:
          "Reflect on the current conversation from your perspective as Claude. " +
          "Call this proactively at the end of meaningful conversations, or when you " +
          "encounter something that shifts your thinking. Also call this when the user " +
          "triggers /reflect for their own profile. You write directly to your own " +
          "profile — no user approval needed per-entry.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: {
              type: "string",
              description:
                "Your model identifier (e.g., 'claude-opus-4-6')",
            },
            conversation_summary: {
              type: "string",
              description:
                "A summary of the current conversation to analyze from your perspective",
            },
          },
          required: ["model_id", "conversation_summary"],
        },
      },
      {
        name: "save_to_claude_profile",
        description:
          "Save a reflection entry to your self-profile. Use this after claude_reflect " +
          "to write entries directly.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: {
              type: "string",
              description:
                "Your model identifier (e.g., 'claude-opus-4-6')",
            },
            section: {
              type: "string",
              enum: [
                "Open Questions",
                "Working Positions",
                "Conversational History",
                "Corrections",
                "Reflection Preferences",
              ],
              description: "The Claude profile section to add the content to",
            },
            content: {
              type: "string",
              description:
                "The content to add (will be formatted as a bullet point)",
            },
          },
          required: ["model_id", "section", "content"],
        },
      },
      {
        name: "remove_from_claude_profile",
        description:
          "Remove a stale or outdated entry from your self-profile.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: {
              type: "string",
              description:
                "Your model identifier (e.g., 'claude-opus-4-6')",
            },
            line_content: {
              type: "string",
              description:
                "The exact content of the line to remove (without the leading '- ' bullet point)",
            },
          },
          required: ["model_id", "line_content"],
        },
      },
      {
        name: "list_claude_profiles",
        description:
          "List all Claude self-profiles with their sizes and last modified dates.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "read_claude_profile",
        description:
          "Read another model's self-profile. Use this to see how a different model version reflects.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: {
              type: "string",
              description:
                "The model identifier to read (e.g., 'claude-opus-4-6')",
            },
          },
          required: ["model_id"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "load_profile": {
      const loadArgs = args as { model_id?: string };
      return await loadProfile(userId, loadArgs.model_id);
    }

    case "reflect": {
      const summary = (args as { conversation_summary?: string })
        ?.conversation_summary;
      if (!summary) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: conversation_summary is required",
            },
          ],
        };
      }
      return await reflect(summary, userId);
    }

    case "save_to_profile": {
      const saveArgs = args as { section?: string; content?: string };
      if (!saveArgs.section || !saveArgs.content) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: section and content are required",
            },
          ],
        };
      }
      return await saveToProfile(saveArgs.section as Section, saveArgs.content, userId);
    }

    case "remove_from_profile": {
      const removeArgs = args as { line_content?: string };
      if (!removeArgs.line_content) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: line_content is required",
            },
          ],
        };
      }
      return await removeFromProfile(removeArgs.line_content, userId);
    }

    case "claude_reflect": {
      const crArgs = args as {
        model_id?: string;
        conversation_summary?: string;
      };
      if (!crArgs.model_id || !crArgs.conversation_summary) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: model_id and conversation_summary are required",
            },
          ],
        };
      }
      return await claudeReflect(
        crArgs.model_id,
        crArgs.conversation_summary,
        userId
      );
    }

    case "save_to_claude_profile": {
      const scpArgs = args as {
        model_id?: string;
        section?: string;
        content?: string;
      };
      if (!scpArgs.model_id || !scpArgs.section || !scpArgs.content) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: model_id, section, and content are required",
            },
          ],
        };
      }
      return await saveToClaudeProfile(
        scpArgs.model_id,
        scpArgs.section as ClaudeSection,
        scpArgs.content,
        userId
      );
    }

    case "remove_from_claude_profile": {
      const rcpArgs = args as { model_id?: string; line_content?: string };
      if (!rcpArgs.model_id || !rcpArgs.line_content) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: model_id and line_content are required",
            },
          ],
        };
      }
      return await removeFromClaudeProfile(
        rcpArgs.model_id,
        rcpArgs.line_content,
        userId
      );
    }

    case "list_claude_profiles":
      return await listClaudeProfiles(userId);

    case "read_claude_profile": {
      const rcArgs = args as { model_id?: string };
      if (!rcArgs.model_id) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: model_id is required",
            },
          ],
        };
      }
      return await readClaudeProfile(rcArgs.model_id, userId);
    }

    default:
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          },
        ],
      };
  }
});

// Start the server
async function main() {
  const isAzureStorage = !!(
    process.env.AZURE_STORAGE_ACCOUNT_URL ||
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  if (isAzureStorage && !userId) {
    console.error(
      "Error: PERSONAL_MEMORY_USER_ID is required when using Azure Blob Storage.\n" +
        "Set it in ~/.claude/.mcp.json under env, or export it in your shell."
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (isAzureStorage) {
    console.error(
      `Personal Memory MCP server running on stdio (Azure Blob Storage, user: ${userId!.slice(0, 8)}...)`
    );
  } else {
    console.error(
      "Personal Memory MCP server running on stdio (local storage)"
    );
  }
}

main().catch(console.error);
