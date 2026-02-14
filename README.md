# Personal Memory

Your identity shouldn't be locked inside one AI application.

## Why This Exists

Claude.ai has memory, but it's trapped in a single interface. Meanwhile, many of us find ourselves living in Claude Code—it's more capable, more flexible, and handles complex workflows that the web and mobile apps simply can't. But Claude Code doesn't remember you between sessions.

**Personal Memory fixes this.** It brings persistent memory to Claude Code through a simple MCP server.

But the vision is bigger: **your personal profile should be portable.** Not locked to Claude.ai. Not locked to Claude Code. Not locked to any single AI tool. As MCP becomes the standard interface for AI applications, your identity, preferences, and context should follow you everywhere—to any tool, any interface, any agent that speaks MCP.

This is step one: a human-readable `me.md` file that any MCP-compatible AI can load.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  me.md (Azure Blob Storage)                  │
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
           │ reflect (writes)                   │ load_profile (reads)
           │                                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Any MCP-Compatible AI Tool                     │
│      (Claude Code, Claude.ai via connector, others)         │
└─────────────────────────────────────────────────────────────┘
```

- **`load_profile`**: Load your identity into the current session
- **`reflect`**: Analyze the conversation and propose new facts to remember
- **`save_to_profile`**: Save approved facts to your profile

You control what gets saved. The AI proposes, you approve.

### Claude Self-Profile

Claude also maintains its own persistent profile — a space for accumulating positions, open questions, and corrections across conversations. Each model version gets its own profile.

- **`claude_reflect`**: Claude self-reflects autonomously at the end of meaningful conversations
- **`save_to_claude_profile`**: Write entries directly (no user approval per-entry)
- **`list_claude_profiles`** / **`read_claude_profile`**: Browse profiles across model versions

The goal: Claude becomes a collaborator that accumulates, not one that starts fresh each time.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/edd426/personal_memory.git
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

### 3. Set Up Storage

Set Azure Blob Storage environment variables:

```bash
export AZURE_STORAGE_ACCOUNT_URL="https://<account>.blob.core.windows.net"
export PERSONAL_MEMORY_USER_ID="<your-user-id>"
```

Or for local development with connection string:

```bash
export AZURE_STORAGE_CONNECTION_STRING="<connection-string>"
export PERSONAL_MEMORY_USER_ID="<your-user-id>"
```

Your profile will be created automatically on first `/reflect`, or you can use the template in `templates/me.md` as a starting point.

### 4. Use It

Restart Claude Code. The MCP tools are now available:
- Use `load_profile` to load your context
- Use `reflect` after meaningful conversations to capture what was learned

---

## Profile Sections

| Section | Purpose |
|---------|---------|
| **Identity** | Name, role, location, background |
| **Current Focus** | Active projects, current priorities |
| **Interests & Passions** | What you care about beyond work |
| **Goals** | Short-term and long-term objectives |
| **Learned Facts** | Accumulated knowledge (grows over time) |
| **Pet Peeves** | Things to avoid, anti-patterns |
| **Relationships** | People in your life |

---

## Design Philosophy

- **Portable**: Plain markdown file, not a proprietary format
- **Explicit**: You choose when to load and save—no silent background capture
- **Human-readable**: Edit your profile directly in any text editor
- **Privacy-first**: Your profile stays local, never committed to repos
- **MCP-native**: Works with any tool that supports the MCP protocol

---

## Roadmap

| Phase | Goal |
|-------|------|
| **v1 (current)** | MCP server for Claude Code |
| **v2** | Time-tiering (Top of mind → Recent → Long-term) |
| **v3** | iCloud sync across machines |
| **v4** | Cloud deployment for Claude.ai mobile via MCP connector |
| **v5** | Semantic search, confidence decay, multi-profile support |

See [docs/roadmap.md](docs/roadmap.md) for details.

---

## Documentation

- [docs/research.md](docs/research.md) - Analysis of ChatGPT memory, Claude.ai memory, Mem0, and other implementations
- [docs/roadmap.md](docs/roadmap.md) - Future phases with implementation details

---

## Related Projects

- [Mem0](https://github.com/mem0ai/mem0) - Universal memory layer for AI
- [Claude-Mem](https://github.com/thedotmack/claude-mem) - Claude Code memory plugin
- [OpenMemory](https://github.com/CaviraOSS/OpenMemory) - Cognitive memory engine for LLMs

---

## License

MIT
