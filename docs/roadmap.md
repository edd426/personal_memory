# Roadmap

Future phases and features for the personal memory system.

---

## Current State (v1)

**Implemented**:
- MCP server with 3 tools (`load_profile`, `reflect`, `save_to_profile`)
- Markdown profile at `~/.claude/me.md`
- 6 sections: Identity, Current Focus, Interests, Goals, Learned Facts, Pet Peeves
- Manual `/me` to load, `/reflect` to save
- LLM proposes additions, user approves each

**Design Decisions**:
- Explicit commands only (no auto-capture)
- No metadata/timestamps in v1
- Manual pruning (no decay)
- Local storage only

---

## Phase 2: Time-Tiering

**Goal**: Add temporal organization like Claude.ai's memory structure

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

### Open Questions
- How to detect "reinforcement" (mentioned in conversation)?
- What triggers tier migration? Daily cron? Session start?
- Should users be notified when items migrate?

---

## Phase 3: iCloud Sync

**Goal**: Profile accessible across multiple Macs

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

## Phase 4: Cloud Deployment (Azure)

**Goal**: Enable Claude.ai mobile access via MCP connector

### Architecture Options

**Option A: Azure Functions + Blob Storage**
```
Claude.ai Mobile → MCP Connector → Azure Function → Blob Storage (me.md)
```
- Serverless, pay-per-use
- Simple file read/write operations
- SAS tokens for authentication

**Option B: Azure Container Apps**
```
Claude.ai Mobile → MCP Connector → Container App (MCP Server) → Blob Storage
```
- Persistent MCP server
- More complex but maintains server state
- Could cache profile in memory

**Option C: Cloudflare Workers**
```
Claude.ai Mobile → MCP Connector → Cloudflare Worker → R2 Storage
```
- Edge deployment, low latency globally
- Different development model (Workers runtime)
- Potentially cheaper at scale

### Security Considerations
- Encryption at rest (Azure provides this)
- SAS tokens with minimal permissions
- Audit logging
- No secrets stored in profile
- Consider client-side encryption for sensitive facts

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

Based on value vs complexity:

| Priority | Feature | Value | Complexity |
|----------|---------|-------|------------|
| 1 | Time-tiering | High | Medium |
| 2 | iCloud sync | High | Low |
| 3 | Azure deployment | High | High |
| 4 | Confidence scoring | Medium | Medium |
| 5 | Semantic search | Medium | High |
| 6 | Multi-profile | Medium | Medium |
| 7 | Auto-reflection | Low | Low |
| 8 | Versioning | Low | Medium |

---

## Open Questions for Future

1. **Granularity**: Should "Learned Facts" be categorized (work, personal, technical)?
2. **Privacy levels**: Some facts are shareable, others are private?
3. **Source tracking**: Note which project/session a learning came from?
4. **Conflict resolution**: What if mobile and desktop edits conflict?
5. **Export format**: Should we support exporting to other memory systems?
6. **Import from Claude.ai**: Periodic sync from Claude.ai's native memory?
