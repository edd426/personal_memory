#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadProfile } from "./tools/loadProfile.js";
import { reflect, saveToProfile } from "./tools/reflect.js";

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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "load_profile":
      return await loadProfile();

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
      return await reflect(summary);

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
      return await saveToProfile(
        saveArgs.section as Parameters<typeof saveToProfile>[0],
        saveArgs.content
      );

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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Personal Memory MCP server running on stdio");
}

main().catch(console.error);
