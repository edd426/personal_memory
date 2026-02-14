# Memory Systems Research

Research conducted January 2025 on existing memory implementations for LLMs.

---

## How the Major Players Implement Memory

### ChatGPT Memory (OpenAI)

**Source**: [Reverse Engineering ChatGPT Memory](https://llmrefs.com/blog/reverse-engineering-chatgpt-memory)

**Key Architecture Insights**:
- **No vector DB / No RAG** - surprisingly simple architecture
- Uses a 4-layer context window system:
  1. **Session Metadata** - device, browser, timezone (temporary)
  2. **User Memory** - ~33 permanent facts (name, preferences, projects)
  3. **Recent Conversations** - ~15 lightweight summaries (not full transcripts)
  4. **Current Session** - full transcript with token limits
- Pre-computes summaries and injects directly (no search latency)
- Memory storage requires explicit user action or confirmation
- Permanent facts are prioritized over session history when token budget is tight

### Claude.ai Memory (Anthropic)

**Source**: [Claude vs ChatGPT Memory Comparison](https://simonwillison.net/2025/Sep/12/claude-memory/)

**Key Architecture Insights**:
- Implements memory as **explicit tool calls** the model decides to invoke
- Two function tools: `conversation_search` and `recent_chats`
- Starts each conversation with a "blank slate"
- Searches raw conversation history without AI-generated summaries
- Enterprise/Team tier adds AI-generated summaries (more like ChatGPT)

**Tradeoffs vs ChatGPT**:
| Aspect | Claude | ChatGPT |
|--------|--------|---------|
| Transparency | Tool calls visible | Automatic, less visible |
| Context pollution | Lower risk (blank slate) | Mitigated by excluding LLM responses |
| User control | Explicit invocation | Always active |

---

## Open Source Implementations

### Mem0 (mem0ai/mem0)

**Links**:
- [GitHub](https://github.com/mem0ai/mem0) (~12k stars)
- [Website](https://mem0.ai/)
- [arXiv Paper](https://arxiv.org/abs/2504.19413)
- [DataCamp Tutorial](https://www.datacamp.com/tutorial/mem0-tutorial)
- [Architecture Deep Dive](https://medium.com/@parthshr370/from-chat-history-to-ai-memory-a-better-way-to-build-intelligent-agents-f30116b0c124)

**Key Features**:
- Hybrid architecture: graph + vector + key-value stores
- 5-pillar design:
  1. LLM-powered fact extraction
  2. Vector storage for semantic similarity
  3. Graph storage for relationships
  4. Automatic deduplication
  5. Multi-scope memory (user, session, agent)
- Benchmarks: 26% higher response quality than OpenAI memory, 90% fewer tokens
- Latency: p50 0.148s, p95 0.200s
- Raised $24M (October 2025)
- Works with any LLM provider

**Memory Types**:
- Long-term memory
- Short-term memory
- Semantic memory (conceptual knowledge)
- Episodic memory (specific events)

---

### Claude-Mem (thedotmack/claude-mem)

**Links**:
- [GitHub](https://github.com/thedotmack/claude-mem)
- [Overview](https://aisharenet.com/en/claude-mem/)

**Key Features**:
- Claude Code plugin using lifecycle hooks
- 6-component system:
  1. 5 Lifecycle Hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd)
  2. Smart Install (dependency validator)
  3. Worker Service (HTTP API on port 37777)
  4. SQLite Database with FTS5 full-text search
  5. mem-search Skill
  6. Chroma Vector Database
- **3-layer progressive disclosure** for token efficiency:
  1. Search layer (~50-100 tokens) - returns compact IDs
  2. Timeline layer - chronological context
  3. Detail layer (~500-1000 tokens) - full observation content
- Achieves ~10x token savings
- Privacy-first: `<private>` tags exclude content from storage
- Beta "Endless Mode" with biomimetic memory architecture

---

### memory-mcp

**Links**:
- [Architecture Article](https://dev.to/suede/the-architecture-of-persistent-memory-for-claude-code-17d)

**Key Features**:
- Leverages Claude Code's built-in CLAUDE.md loading
- Two-tier storage:
  1. **Hot tier (CLAUDE.md)**: ~150 lines, high-confidence, auto-injected
  2. **Cold tier (.memory/state.json)**: unlimited, searchable on-demand
- **Time-based decay system**:
  - Permanent: architecture, decisions, patterns
  - Decaying: Progress (7-day half-life), Context (30-day half-life)
  - Items below 0.3 confidence excluded from CLAUDE.md
- Cost-effective: only Haiku API calls (~$0.001 per extraction)
- Deduplication via Jaccard similarity (60% threshold)
- LLM consolidation every 10 extractions

---

### OpenMemory (CaviraOSS/OpenMemory)

**Links**:
- [GitHub](https://github.com/CaviraOSS/OpenMemory)

**Key Features**:
- "Cognitive memory engine for LLMs and agents"
- Self-hosted, Python + Node
- Native MCP server
- Apache 2.0 license
- Explicitly "not RAG, not a vector DB"

---

### Claude Brain

**Links**:
- [Medium Article](https://medium.com/@mbonsign/claude-brain-giving-the-claude-ap-memory-and-the-power-to-execute-code-56e50bce5b24)

**Key Features**:
- Open-source for Claude Desktop via MCP
- Two capabilities:
  1. Persistent memory (cross-session)
  2. Active execution (code running)

---

### Claude-Flow Memory System

**Links**:
- [GitHub Wiki](https://github.com/ruvnet/claude-flow/wiki/Memory-System)

**Key Features**:
- SQLite-based persistent memory
- Cross-session state management
- Agent coordination support

---

### RLM-Claude (EncrEor/rlm-claude)

**Links**:
- [GitHub](https://github.com/EncrEor/rlm-claude)
- Inspired by: [MIT CSAIL RLM Paper](https://arxiv.org/abs/2512.24601) (Dec 2025)

**Overview**: "Recursive Language Models for Claude Code - Infinite memory solution"

**Key Architecture**:
```
┌─────────────────────────┐
│     Claude Code CLI     │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│    RLM MCP Server       │
│    (14 tools)           │
└───────────┬─────────────┘
            │
┌───────────┼───────────────────────┐
│           │                       │
▼           ▼                       ▼
Insights    Chunks              Retention
(decisions  (full conv          (auto-archive
 facts)      history)            restore/purge)
```

**Two Memory Systems**:
| System | What it stores | Tools |
|--------|---------------|-------|
| **Insights** | Key decisions, facts, preferences | `rlm_remember()` / `rlm_recall()` / `rlm_forget()` |
| **Chunks** | Full conversation segments | `rlm_chunk()` / `rlm_peek()` / `rlm_grep()` / `rlm_search()` |

**14 MCP Tools**:
1. `rlm_remember` - Save insights with category/importance/tags
2. `rlm_recall` - Search insights by keyword, category, importance
3. `rlm_forget` - Remove an insight
4. `rlm_status` - System overview and metrics
5. `rlm_chunk` - Save conversation segments
6. `rlm_peek` - Read a chunk (full or partial)
7. `rlm_grep` - Regex search + fuzzy matching
8. `rlm_search` - BM25 ranked search (FR/EN, accent-normalized)
9. `rlm_list_chunks` - List all chunks with metadata
10. `rlm_sessions` - Browse by project/domain
11. `rlm_domains` - List available domains
12. `rlm_retention_preview` - Dry-run archive preview
13. `rlm_retention_run` - Archive old, purge ancient
14. `rlm_restore` - Bring back archived chunks

**Hooks Integration** (Auto-save before `/compact`):
```json
{
  "hooks": {
    "PreCompact": [{
      "matcher": "manual",
      "hooks": [{ "type": "command", "command": "python3 ~/.claude/rlm/hooks/pre_compact_chunk.py" }]
    }]
  }
}
```

**Skill Definitions** (Slash commands):
- `/rlm-analyze <chunk_id> "<question>"` - Analyze chunk with sub-agent
- `/rlm-parallel` - Map-Reduce pattern from MIT RLM paper
- Skills stored in `~/.claude/skills/rlm-analyze/skill.md`

**Smart Retention Lifecycle**:
```
Active → Archive (.gz) → Purge
```
- Immunity system: critical tags, frequent access, keywords protect chunks

**Standout Features**:
1. **PreCompact hook** - Auto-snapshot before context is wiped
2. **Multi-project support** - Cross-project filtering, auto-detection from git
3. **BM25 + fuzzy search** - Typo-tolerant, FR/EN tokenization
4. **3-zone retention** - Active/Archive/Purge lifecycle
5. **Sub-agent skills** - Isolated analysis without context pollution
6. **Zero config install** - 3 lines, `./install.sh`

**Storage**:
```
context/
├── session_memory.json    # Insights
├── index.json             # Chunk index
├── chunks/                # Full conversation history
├── archive/               # Compressed .gz
└── sessions.json          # Session index
```

**Comparison to Personal Memory**:
| Aspect | RLM-Claude | Personal Memory |
|--------|------------|-----------------|
| Focus | Session/conversation memory | Personal identity/profile |
| Storage | JSON + chunks | Markdown (me.md) |
| Scope | Per-project | Cross-project (user-level) |
| Automation | Auto-chunk on compact | Explicit /reflect only |
| Complexity | 14 tools, hooks, skills | 3 tools, minimal |
| Use case | Long coding sessions | Personal preferences/facts |

**Potential Integration Ideas**:
1. **Adopt hooks pattern** - PreCompact hook for auto-save
2. **Skill definitions** - Use `~/.claude/skills/` for `/me` and `/reflect`
3. **Retention system** - Time-based archival for stale profile items
4. **BM25 search** - If profile grows large, add search capability

---

## Key Insights for Personal Memory Project

### What We Adopted

1. **Explicit commands** (`/me`, `/reflect`) - like Claude.ai's approach
2. **Markdown storage** - human-readable, unlike most implementations using SQLite/JSON
3. **User approval for additions** - like ChatGPT's explicit confirmation
4. **MCP server architecture** - enables future Claude.ai mobile access

### What We Deferred to v2+

1. **Time-based decay** (from memory-mcp) - 7-day/30-day half-lives
2. **Progressive disclosure** (from Claude-Mem) - token efficiency layers
3. **Graph relationships** (from Mem0) - connecting facts
4. **Semantic search** (from Mem0/Claude-Mem) - vector embeddings
5. **Confidence scoring** (from memory-mcp) - 0-1 scores per fact
6. **Skill definitions** (from RLM-Claude) - `~/.claude/skills/` for slash commands
7. **PreCompact hooks** (from RLM-Claude) - auto-save before context wipe

### Unique to Our Approach

1. **Personal identity focus** - most tools are project/conversation-centric
2. **Portable markdown** - `me.md` can be manually edited, version-controlled
3. **Intentional reflection** - `/reflect` is user-initiated, not automatic
4. **Cross-platform vision** - designed for Claude.ai mobile from the start

### Implementation Gap: Slash Commands

RLM-Claude demonstrates how to implement `/command` style invocation:

**Skill structure** (e.g., `~/.claude/skills/me/skill.md`):
```markdown
# /me

Load personal profile into the current session.

## Behavior

Call `mcp__personal-memory__load_profile` to load your profile

## Usage

Just type `/me` to load your profile context.
```

This would solve our missing `/me` and `/reflect` commands by creating skill definitions that wrap the MCP tools.
