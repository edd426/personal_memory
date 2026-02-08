#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createStorage } from "./storage/index.js";
import { createLoadProfile } from "./tools/loadProfile.js";
import {
  createReflect,
  createSaveToProfile,
  createRemoveFromProfile,
  type Section,
} from "./tools/reflect.js";

// Initialize storage and tools
const storage = createStorage();
const userId = process.env.PERSONAL_MEMORY_USER_ID;
const loadProfile = createLoadProfile(storage);
const reflect = createReflect(storage);
const saveToProfile = createSaveToProfile(storage);
const removeFromProfile = createRemoveFromProfile(storage);

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
          "Load your personal profile (me.md) into the current session context. " +
          "Use this when you want Claude to know about your identity, interests, " +
          "goals, and preferences.",
        inputSchema: {
          type: "object" as const,
          properties: {},
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "load_profile":
      return await loadProfile(userId);

    case "reflect":
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

    case "save_to_profile":
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

    case "remove_from_profile":
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
      "Personal Memory MCP server running on stdio (local storage: ~/.claude/me.md)"
    );
  }
}

main().catch(console.error);
