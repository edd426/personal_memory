# Roadmap

Future phases and features for the personal memory system.

---

## Current State (v1)

**Implemented**:
- MCP server with 4 tools (`load_profile`, `reflect`, `save_to_profile`, `remove_from_profile`)
- Markdown profile at `~/.claude/me.md`
- 6 sections: Identity, Current Focus, Interests, Goals, Learned Facts, Pet Peeves
- Manual `/me` to load, `/reflect` to save
- LLM proposes additions AND removals, user approves each

**Design Decisions**:
- Explicit commands only (no auto-capture)
- No metadata/timestamps in v1
- Manual pruning (no decay)
- Local storage only

---

## Phase 2: Cloud Deployment (Azure)

**Goal**: Enable Claude.ai and mobile access via remote MCP server

This is the priority feature - it unlocks `/me` and `/reflect` from Claude.ai web, iOS, and Android apps.

### Architecture

**Azure Functions + Blob Storage** (recommended):
```
Claude.ai / Mobile → Custom Connector → Azure Function (HTTP) → Blob Storage (me.md)
```
- Serverless, pay-per-use
- Simple file read/write operations
- Minimal code changes from local MCP server

### Implementation Steps

1. **Transport change**: Swap `StdioServerTransport` → HTTP request handler
2. **Storage change**: `~/.claude/me.md` → Azure Blob Storage
3. **Auth**: Start authless for testing, add OAuth later
4. **Deploy**: Azure Functions with Node.js runtime

### Claude.ai Integration

- Add as Custom Connector: Settings → Connectors → Add custom connector
- Enter Azure Function URL (HTTPS required)
- Works on Pro, Max, Team, Enterprise plans
- iOS/Android automatically get access to connectors added via web

### Security Considerations
- Encryption at rest (Azure provides this)
- Start with authless + obscure URL for MVP
- Add OAuth for production (Claude supports it natively)
- Audit logging via Azure Monitor
- No secrets stored in profile
- Consider client-side encryption for sensitive facts

### Risk Assessment
- **Low risk to existing experience**: Local MCP server keeps working unchanged
- **Additive feature**: Cloud deployment is a second access point, not a replacement

---

## Phase 2.5: Stability & Observability

**Goal**: Make the deployed MCP server reliable and debuggable.

### Error Messaging
Currently tool errors surface as the generic "Error occurred during tool execution" in Claude.ai. We need:
- Structured error responses with error codes, descriptions, and hints
- Differentiate between auth errors, storage errors, timeout errors, and transport errors
- Log all errors with request context to Application Insights
- Surface actionable messages to the client (e.g., "Profile not found" vs "Storage unavailable")

### SSE Timeout on Consumption Plan
MCP Streamable HTTP uses long-lived SSE connections. Azure Functions Consumption plan has a **10-minute maximum** timeout. This causes intermittent failures when sessions exceed the timeout.

**Options** (in order of preference):
1. **Azure Container Apps** — supports long-running HTTP, scales to zero, ~same cost
2. **Azure Functions Flex Consumption** — longer HTTP timeouts when available
3. **Premium Functions plan** — 30-min default timeout, but always-on cost (~$100+/mo)
4. **Stateless reconnection** — detect timeout, re-establish session transparently (complex)

### Implementation Priority
| Task | Effort | Impact |
|------|--------|--------|
| Better error messages in tool responses | Small | High |
| Structured logging with App Insights | Small | High |
| Evaluate Container Apps migration | Medium | High |

---

## Phase 3: iCloud Sync

**Goal**: Profile accessible across multiple Macs (local Claude Code usage)

Note: Once Phase 2 is complete, this becomes less critical since cloud storage handles cross-device access. Still useful for offline scenarios.

### Implementation

**Storage location**:
```
~/Library/Mobile Documents/com~apple~CloudDocs/claude-profile/me.md
```

**Symlink strategy**:
```bash
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/claude-profile/me.md ~/.claude/me.md
```

**Conflict handling**:
- iCloud handles basic merge conflicts
- Could add last-modified timestamps to detect stale reads
- Consider append-only sections to minimize conflicts

### Considerations
- Mac-only (iCloud doesn't work on Linux/Windows)
- Need to handle iCloud sync delays
- Should we lock file during writes?

---

## Phase 4: Time-Tiering

**Goal**: Add temporal organization like Claude.ai's memory structure

**Deferred because**: Higher risk (modifies me.md structure), lower immediate value compared to cloud access.

### Features

**Time-based sections** (replacing/augmenting Current Focus):
```markdown
## Top of Mind
<!-- Active this week -->

## Recent Months
<!-- Last 1-3 months -->

## Earlier Context
<!-- 3-12 months ago -->

## Long-term Background
<!-- Permanent context -->
```

**Automatic tier migration**:
- Items start in "Top of Mind"
- After N days without reinforcement, move down a tier
- "Long-term Background" items are permanent

**Implementation options**:
1. **Date-tagged entries**: Each item gets `(added: 2025-01-15)` suffix
2. **Separate metadata file**: `me.meta.json` tracks dates, `me.md` stays clean
3. **YAML frontmatter**: Dates in frontmatter, content in body

**Simpler alternative**: Just add dates to "Current Focus" items and prompt for cleanup during `/reflect` when items are stale (>14 days).

### Open Questions
- How to detect "reinforcement" (mentioned in conversation)?
- What triggers tier migration? Daily cron? Session start?
- Should users be notified when items migrate?

---

## Phase 5: Advanced Features

### Semantic Search
- Embed "Learned Facts" entries
- "What did I say about X?" queries
- Cluster related learnings
- Implementation: Chroma, Pinecone, or Azure AI Search

### Confidence Scoring
- Each fact gets a 0-1 confidence score
- Scores decay over time without reinforcement
- Low-confidence items excluded from default load
- User can view/boost low-confidence items
- Based on: recency, frequency of mention, explicit confirmation

### Automatic Reflection Prompts
- Hook at session end
- Claude summarizes what was learned
- User reviews before committing
- Could be opt-in via `/reflect-on-exit` toggle

### Profile Versioning
- Git-like history of changes
- "What did my profile look like 3 months ago?"
- Rollback capability
- Implementation: simple git repo, or append-only changelog

### Multi-Profile Support
- Work vs personal contexts
- Project-specific overlays
- Commands: `/me work`, `/me personal`
- Inheritance: project profile extends personal profile

### Cross-Project Memory
- Learnings from one project inform others
- "In project X, you preferred Y" suggestions
- Shared "Learned Facts" across all projects

---

## Integration Opportunities

### Newsletter Curation (email_insights_standalone)
Profile could power personalized ranking:
```markdown
## Newsletter Preferences
- Primary interests: AI/ML, software architecture, economics
- Prefer: Deep technical content over news summaries
- Skip: Marketing, redundant coverage
- Favorite authors: [learned over time]
```

### IDE Extensions
- VS Code extension that loads profile on startup
- Cursor integration
- JetBrains plugin

### Other Claude Tools
- Claude Desktop
- Claude API projects
- Custom agents built with Claude

---

## Implementation Priority

Based on value vs complexity vs risk:

| Priority | Feature | Value | Complexity | Risk |
|----------|---------|-------|------------|------|
| 1 | Azure deployment | High | Medium | Low |
| 2 | iCloud sync | Medium | Low | Low |
| 3 | Time-tiering | Medium | Medium | High |
| 4 | Confidence scoring | Medium | Medium | Medium |
| 5 | Semantic search | Medium | High | Low |
| 6 | Multi-profile | Medium | Medium | Low |
| 7 | Auto-reflection | Low | Low | Low |
| 8 | Versioning | Low | Medium | Low |

**Why Azure first?**
- Unlocks Claude.ai web + mobile access (high value)
- Additive feature - local MCP keeps working (low risk)
- Azure Functions + Blob Storage is straightforward (medium complexity)
- Learning opportunity for Azure services

---

## Open Questions for Future

1. **Granularity**: Should "Learned Facts" be categorized (work, personal, technical)?
2. **Privacy levels**: Some facts are shareable, others are private?
3. **Source tracking**: Note which project/session a learning came from?
4. **Conflict resolution**: What if mobile and desktop edits conflict?
5. **Export format**: Should we support exporting to other memory systems?
6. **Import from Claude.ai**: Periodic sync from Claude.ai's native memory?
