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

## Design Decisions (v1)

- **Storage**: Azure Blob Storage is the source of truth (local `~/.claude/me.md` used only for local-only setups)
- **Capture**: Explicit `/reflect` only (intentional, not automatic)
- **Loading**: Explicit `/me` only (user decides when relevant)
- **Extraction**: LLM proposes, user approves each before saving
- **Pruning**: Manual (user reviews and removes stale items)
- **Implementation**: MCP server (enables future Claude.ai mobile access)

## Storage Roadmap

1. **v1**: Local file at `~/.claude/me.md`
2. **v2**: iCloud sync
3. **v3**: Azure deployment for Claude.ai mobile access

## Project Structure

```
personal_memory/
├── CLAUDE.md              # This file (project instructions for Claude)
├── README.md              # Project overview and quick start
├── docs/
│   ├── research.md        # Analysis of existing memory implementations
│   └── roadmap.md         # Future phases and features
├── templates/
│   └── me.md              # Profile template
└── src/                   # MCP server (TypeScript)
    ├── server.ts
    └── tools/
        ├── loadProfile.ts
        └── reflect.ts
```

## Documentation

- [README.md](README.md) - Quick start and usage
- [docs/research.md](docs/research.md) - Research on Mem0, Claude-Mem, ChatGPT/Claude memory
- [docs/roadmap.md](docs/roadmap.md) - Time-tiering, iCloud sync, Azure deployment plans
