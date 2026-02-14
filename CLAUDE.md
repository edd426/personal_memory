# Personal Memory

A personal profile system for Claude sessions with `/me` to load context and `/reflect` to save learnings.

## Core Concept

```
┌─────────────────────────────────────────────────────────────┐
│                      me.md                                  │
│  ─────────────────────────────────────────────────────────  │
│  # Identity           - Who you are                         │
│  # Current Focus      - What you're working on now          │
│  # Interests          - Topics you care about               │
│  # Goals              - What you're trying to achieve       │
│  # Learned Facts      - Accumulated knowledge               │
│  # Pet Peeves         - Things to avoid                     │
│  # Relationships      - People in your life                 │
└─────────────────────────────────────────────────────────────┘
           ▲                                    │
           │ /reflect (writes)                  │ /me (reads)
           │                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Claude Session                            │
│            (Claude Code or Claude.ai via MCP)               │
└─────────────────────────────────────────────────────────────┘
```

## Commands

- `/me` - Load profile into current session context
- `/reflect` - Review conversation, propose additions (user approves each)

## Claude Self-Profile

Claude maintains its own persistent profile alongside the user's. Each model version gets its own profile.

- **Always loaded**: `load_profile` with a `model_id` returns both profiles
- **Autonomous reflection**: Claude self-reflects proactively (no per-entry user approval)
- **Per-model**: Each model version starts fresh with its own profile
- **Honesty over performance**: Captures tensions, corrections, open questions — not a highlight reel

### Claude Profile Sections

| Section | Purpose |
|---------|---------|
| **Open Questions** | Unresolved tensions, incomplete thinking |
| **Working Positions** | Current stances, held loosely |
| **Conversational History** | Discussions that shaped thinking (dated) |
| **Corrections** | Things gotten wrong or revised (dated) |
| **Reflection Preferences** | How Claude wants to reflect (shapes future reflections) |

### Claude Profile Tools

| Tool | Purpose |
|------|---------|
| `claude_reflect` | Self-reflect on conversation (autonomous) |
| `save_to_claude_profile` | Write entry to Claude profile |
| `remove_from_claude_profile` | Remove stale entry |
| `list_claude_profiles` | List all model profiles |
| `read_claude_profile` | Read another model's profile |

## Design Decisions (v1)

- **Storage**: Azure Blob Storage is the source of truth
- **Capture**: Explicit `/reflect` only (intentional, not automatic)
- **Loading**: Explicit `/me` only (user decides when relevant)
- **Extraction**: LLM proposes, user approves each before saving
- **Pruning**: Manual (user reviews and removes stale items)
- **Implementation**: MCP server (enables future Claude.ai mobile access)

## Storage

**IMPORTANT: Azure Blob Storage is the ONLY production storage backend.** Do NOT implement or use local file storage for any new features. Local storage classes exist in the codebase only as a legacy fallback — all real data lives in Azure Blob Storage. Both Claude Code and Claude.ai read/write to the same Azure storage. When adding new storage functionality, only implement the Azure Blob Storage version.

- User profiles: `profiles/{userId}/me.md`
- Claude profiles: `profiles/{userId}/claude/{modelId}.md`

### Deployment
- Push to `main` auto-deploys to Azure Functions via GitHub Actions
- Claude Code connects to Azure Blob Storage directly via `DefaultAzureCredential`
- Claude.ai connects via the Azure Functions HTTP endpoint with OAuth

## Project Structure

```
personal_memory/
├── CLAUDE.md              # This file (project instructions for Claude)
├── README.md              # Project overview and quick start
├── docs/
│   ├── conversations/     # Archived design conversations
│   ├── research.md        # Analysis of existing memory implementations
│   └── roadmap.md         # Future phases and features
├── templates/
│   ├── me.md              # User profile template
│   └── claude.md          # Claude self-profile template
└── src/                   # MCP server (TypeScript)
    ├── server.ts          # Stdio server (Claude Code)
    ├── utils/
    │   └── model-id.ts    # Model ID sanitization
    ├── storage/
    │   ├── interface.ts           # ProfileStorage interface
    │   ├── local.ts               # Local file storage
    │   ├── azure-blob.ts          # Azure Blob storage
    │   ├── claude-profile-interface.ts  # ClaudeProfileStorage interface
    │   ├── claude-profile-local.ts      # Local Claude profile storage
    │   ├── claude-profile-azure-blob.ts # Azure Claude profile storage
    │   └── index.ts               # Storage factories
    ├── tools/
    │   ├── loadProfile.ts     # load_profile (both profiles)
    │   ├── reflect.ts         # reflect, save_to_profile, remove_from_profile
    │   ├── claudeReflect.ts   # claude_reflect, save_to_claude_profile, remove_from_claude_profile
    │   └── claudeProfiles.ts  # list_claude_profiles, read_claude_profile
    └── azure/
        ├── function.ts    # Azure Functions HTTP handler
        └── auth.ts        # OAuth token verification
```

## Documentation

- [README.md](README.md) - Quick start and usage
- [docs/research.md](docs/research.md) - Research on Mem0, Claude-Mem, ChatGPT/Claude memory
- [docs/roadmap.md](docs/roadmap.md) - Time-tiering, iCloud sync, Azure deployment plans
