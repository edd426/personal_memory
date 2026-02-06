import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createStorage } from "../storage/index.js";
import { createLoadProfile } from "../tools/loadProfile.js";
import {
  createReflect,
  createSaveToProfile,
  createRemoveFromProfile,
  type Section,
} from "../tools/reflect.js";
import { verifyToken, extractUserId } from "./auth.js";

const BASE_URL = "https://func-personal-memory-prod.azurewebsites.net";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Initialize storage and tools
const storage = createStorage();
const loadProfile = createLoadProfile(storage);
const reflect = createReflect(storage);
const saveToProfile = createSaveToProfile(storage);
const removeFromProfile = createRemoveFromProfile(storage);

// Store transports by session ID for stateful sessions
const sessions = new Map<
  string,
  {
    transport: WebStandardStreamableHTTPServerTransport;
    server: Server;
    userId: string;
    createdAt: number;
  }
>();

// Clean up old sessions periodically
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.transport.close();
      sessions.delete(sessionId);
    }
  }
}, 60 * 1000); // Check every minute

function createMCPServerWithUserId(userId: string) {
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
                description:
                  "The content to add (will be formatted as a bullet point)",
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

  // Handle tool calls with userId injected
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

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
        return await saveToProfile(
          saveArgs.section as Section,
          saveArgs.content,
          userId
        );

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

  // After initialization, notify client that tools are available.
  // Works around claude.ai bug where it never calls tools/list.
  server.oninitialized = () => {
    const sendWithRetry = (attempts: number) => {
      server.sendToolListChanged().catch((err) => {
        if (attempts > 0) {
          setTimeout(() => sendWithRetry(attempts - 1), 500);
        }
      });
    };
    setTimeout(() => sendWithRetry(3), 100);
  };

  return server;
}

async function handleMCPRequest(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Verify OAuth token
  const wwwAuthenticate =
    `Bearer error="invalid_token", ` +
    `error_description="A valid access token is required", ` +
    `resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource/mcp"`;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      status: 401,
      headers: { "WWW-Authenticate": wwwAuthenticate },
      jsonBody: { error: "Missing or invalid Authorization header" },
    };
  }

  const token = authHeader.slice(7);
  let userId: string;

  try {
    const claims = await verifyToken(token);
    userId = extractUserId(claims);
  } catch (error) {
    context.error("Token verification failed:", error);
    return {
      status: 401,
      headers: { "WWW-Authenticate": wwwAuthenticate },
      jsonBody: { error: "Invalid token" },
    };
  }

  // Convert Azure Functions HttpRequest to web standard Request
  const webRequest = toWebRequest(request);

  // Check for existing session
  const sessionId = request.headers.get("mcp-session-id");
  let session = sessionId ? sessions.get(sessionId) : undefined;

  // If session exists but belongs to different user, reject
  if (session && session.userId !== userId) {
    return {
      status: 403,
      jsonBody: { error: "Session belongs to different user" },
    };
  }

  // Create new session if needed
  if (!session) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const server = createMCPServerWithUserId(userId);
    await server.connect(transport);

    // We'll store the session after the first request creates a session ID
    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    session = {
      transport,
      server,
      userId,
      createdAt: Date.now(),
    };
  }

  // Handle the request
  const webResponse = await session.transport.handleRequest(webRequest);

  // Store session if it has a session ID now
  if (session.transport.sessionId && !sessions.has(session.transport.sessionId)) {
    sessions.set(session.transport.sessionId, session);
  }

  // Convert web standard Response back to Azure Functions response
  return await toAzureResponse(webResponse);
}

function toWebRequest(azureReq: HttpRequest): Request {
  const url = new URL(azureReq.url);
  const headers = new Headers();

  azureReq.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: azureReq.method,
    headers,
  };

  // Only add body for methods that can have one
  if (azureReq.method !== "GET" && azureReq.method !== "HEAD") {
    init.body = azureReq.body as ReadableStream;
    // Ensure duplex is set for streaming body
    (init as RequestInit & { duplex: string }).duplex = "half";
  }

  return new Request(url.toString(), init);
}

async function toAzureResponse(webRes: Response): Promise<HttpResponseInit> {
  const headers: Record<string, string> = {};
  webRes.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Check if this is an SSE response
  const contentType = webRes.headers.get("content-type");
  if (contentType?.includes("text/event-stream")) {
    // Pass the body as a ReadableStream for proper SSE streaming.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- web vs Node.js ReadableStream type mismatch
    return {
      status: webRes.status,
      headers,
      body: webRes.body as any,
    };
  }

  // For JSON responses, parse and return
  if (contentType?.includes("application/json")) {
    const jsonBody = await webRes.json();
    return {
      status: webRes.status,
      headers,
      jsonBody,
    };
  }

  // Default: return body as text
  const body = await webRes.text();
  return {
    status: webRes.status,
    headers,
    body,
  };
}

// RFC 9728: OAuth Protected Resource Metadata
async function handleProtectedResourceMetadata(
  request: HttpRequest
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: CORS_HEADERS };
  }

  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    return { status: 500, jsonBody: { error: "OAuth not configured" } };
  }

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    },
    jsonBody: {
      resource: `${BASE_URL}/mcp`,
      authorization_servers: [BASE_URL],
      scopes_supported: [`api://${clientId}/mcp.profile.read`],
      resource_name: "Personal Memory MCP Server",
    },
  };
}

// RFC 8414: Authorization Server Metadata
async function handleAuthorizationServerMetadata(
  request: HttpRequest
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: CORS_HEADERS };
  }

  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    return { status: 500, jsonBody: { error: "OAuth not configured" } };
  }

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    },
    jsonBody: {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      authorization_endpoint: `${BASE_URL}/authorize`,
      token_endpoint: `${BASE_URL}/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [`api://${clientId}/mcp.profile.read`],
    },
  };
}

// Health check endpoint
async function healthCheck(): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: "healthy",
      version: "0.1.0",
      service: "personal-memory-mcp",
    },
  };
}

// OAuth endpoints - proxy to Azure Entra ID
// Claude.ai expects these endpoints on the MCP server itself

async function handleAuthorize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    return {
      status: 500,
      jsonBody: { error: "OAuth not configured" },
    };
  }

  // Get the original query parameters from Claude.ai
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  // Build Entra ID authorize URL with Claude.ai's parameters
  const entraAuthorizeUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
  );

  // Forward relevant OAuth parameters (except scope - we override that)
  const forwardParams = [
    "response_type",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];

  for (const param of forwardParams) {
    const value = params.get(param);
    if (value) {
      entraAuthorizeUrl.searchParams.set(param, value);
    }
  }

  // Always set client_id to our app's client ID
  entraAuthorizeUrl.searchParams.set("client_id", clientId);

  // Always use our valid Entra ID scopes (Claude.ai sends 'claudeai' which doesn't exist)
  entraAuthorizeUrl.searchParams.set(
    "scope",
    `api://${clientId}/mcp.profile.read openid profile offline_access`
  );

  context.log(`OAuth authorize redirect to: ${entraAuthorizeUrl.toString()}`);

  return {
    status: 302,
    headers: {
      Location: entraAuthorizeUrl.toString(),
    },
  };
}

async function handleToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return {
      status: 500,
      jsonBody: { error: "OAuth not configured" },
    };
  }

  // Get the request body (form-encoded)
  const body = await request.text();
  const params = new URLSearchParams(body);

  // Build the token request for Entra ID
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  // Create new params with our client credentials
  const tokenParams = new URLSearchParams();
  tokenParams.set("client_id", clientId);
  tokenParams.set("client_secret", clientSecret);

  // Forward relevant parameters from the original request
  const forwardParams = [
    "grant_type",
    "code",
    "redirect_uri",
    "code_verifier",
    "refresh_token",
    "scope",
  ];

  for (const param of forwardParams) {
    const value = params.get(param);
    if (value) {
      tokenParams.set(param, value);
    }
  }

  context.log(`OAuth token request to Entra ID`);

  try {
    // Proxy the token request to Entra ID
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const responseBody = await response.json();

    // Return the Entra ID response to Claude.ai
    return {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
      jsonBody: responseBody,
    };
  } catch (error) {
    context.error("Token exchange failed:", error);
    return {
      status: 500,
      jsonBody: { error: "Token exchange failed" },
    };
  }
}

// Register Azure Functions
app.http("mcp", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous", // We handle auth ourselves via OAuth
  route: "mcp",
  handler: handleMCPRequest,
});

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});

// OAuth proxy endpoints
app.http("authorize", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "authorize",
  handler: handleAuthorize,
});

app.http("token", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "token",
  handler: handleToken,
});

// .well-known discovery endpoints
app.http("protectedResourceMetadata", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: ".well-known/oauth-protected-resource/mcp",
  handler: handleProtectedResourceMetadata,
});

app.http("authorizationServerMetadata", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: ".well-known/oauth-authorization-server",
  handler: handleAuthorizationServerMetadata,
});
