# Personal Memory

A personal profile system for Claude sessions with `/me` to load context and `/reflect` to save learnings.

## Overview

Personal Memory solves the "Claude doesn't remember me" problem by maintaining a persistent profile (`me.md`) that can be loaded into any Claude session on demand.

```
┌─────────────────────────────────────────────────────────────┐
│                      ~/.claude/me.md                        │
│  ─────────────────────────────────────────────────────────  │
│  # Identity           - Who you are                         │
│  # Current Focus      - What you're working on now          │
│  # Interests          - Topics you care about               │
│  # Goals              - What you're trying to achieve       │
│  # Learned Facts      - Accumulated knowledge               │
│  # Pet Peeves         - Things to avoid                     │
└─────────────────────────────────────────────────────────────┘
           ▲                                    │
           │ /reflect (writes)                  │ /me (reads)
           │                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Claude Session                            │
│            (Claude Code or Claude.ai via MCP)               │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd personal_memory
npm install
npm run build
```

### 2. Configure Claude Code

Add to `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "personal-memory": {
      "command": "node",
      "args": ["/path/to/personal_memory/dist/server.js"]
    }
  }
}
```

### 3. Create Your Profile

```bash
cp templates/me.md ~/.claude/me.md
# Edit ~/.claude/me.md with your information
```

### 4. Use It

- **Load profile**: Use the `load_profile` MCP tool (or `/me` skill when configured)
- **Save learnings**: Use the `reflect` MCP tool after conversations
- **Approve additions**: Each proposed fact requires your approval before saving

## MCP Tools

| Tool | Description |
|------|-------------|
| `load_profile` | Reads `~/.claude/me.md` into session context |
| `reflect` | Analyzes conversation, proposes additions for approval |
| `save_to_profile` | Saves an approved fact to a specific section |

## Profile Sections

| Section | Purpose |
|---------|---------|
| **Identity** | Name, role, location, background |
| **Current Focus** | Active projects, this week's priorities |
| **Interests & Passions** | Topics you care about beyond work |
| **Goals** | Short-term and long-term objectives |
| **Learned Facts** | Accumulated knowledge (grows over time) |
| **Pet Peeves** | Things to avoid, anti-patterns |

## Design Philosophy

- **Explicit, not automatic**: You control when to load and save
- **Human-readable**: Markdown file you can edit directly
- **Privacy-first**: Profile stays local, never uploaded to repo
- **Intentional reflection**: `/reflect` is a deliberate act, not background capture

## Documentation

- [Research](docs/research.md) - Analysis of existing memory implementations
- [Roadmap](docs/roadmap.md) - Future phases and features

## Roadmap

| Phase | Features |
|-------|----------|
| **v1 (current)** | MCP server, markdown profile, manual commands |
| **v2** | Time-tiering (Top of mind → Long-term) |
| **v3** | iCloud sync |
| **v4** | Azure deployment for Claude.ai mobile |
| **v5** | Semantic search, confidence scoring, multi-profile |

## Related Projects

This project was inspired by research into existing memory systems:

- [Mem0](https://github.com/mem0ai/mem0) - Universal memory layer for AI
- [Claude-Mem](https://github.com/thedotmack/claude-mem) - Claude Code memory plugin
- [memory-mcp](https://dev.to/suede/the-architecture-of-persistent-memory-for-claude-code-17d) - Persistent memory architecture
- [OpenMemory](https://github.com/CaviraOSS/OpenMemory) - Cognitive memory engine

See [docs/research.md](docs/research.md) for detailed analysis.

## License

MIT
