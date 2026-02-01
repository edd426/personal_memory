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

- **Storage**: Markdown at `~/.claude/me.md` (human-readable, editable)
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
├── CLAUDE.md              # This file
├── templates/
│   └── me.md              # Profile template
└── src/                   # MCP server (TypeScript)
    ├── server.ts
    └── tools/
        ├── loadProfile.ts
        └── reflect.ts
```

## Research References

- [Mem0](https://mem0.ai/) - Universal memory layer for AI
- [Claude-Mem](https://github.com/thedotmack/claude-mem) - Claude Code memory plugin
- [memory-mcp](https://dev.to/suede/the-architecture-of-persistent-memory-for-claude-code-17d) - Persistent memory architecture
- [ChatGPT Memory Reverse Engineered](https://llmrefs.com/blog/reverse-engineering-chatgpt-memory)
- [Claude vs ChatGPT Memory](https://simonwillison.net/2025/Sep/12/claude-memory/)
