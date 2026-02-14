# Roadmap

Future phases and features for the personal memory system.

---

## Current State

**Implemented**:
- MCP server with 9 tools (4 user profile + 5 Claude self-profile)
- User profile tools: `load_profile`, `reflect`, `save_to_profile`, `remove_from_profile`
- Claude self-profile tools: `claude_reflect`, `save_to_claude_profile`, `remove_from_claude_profile`, `list_claude_profiles`, `read_claude_profile`
- User profile stored in Azure Blob Storage (`profiles/{userId}/me.md`)
- Claude profiles stored per-model (`profiles/{userId}/claude/{modelId}.md`)
- 7 user profile sections: Identity, Current Focus, Interests, Goals, Learned Facts, Pet Peeves, Relationships
- 5 Claude profile sections: Open Questions, Working Positions, Conversational History, Corrections, Reflection Preferences
- Manual `/me` to load (loads both profiles when model_id provided), `/reflect` to save
- LLM proposes additions AND removals to user profile, user approves each
- Claude self-reflects autonomously — no per-entry user approval
- Per-model profiles: each model version starts fresh, can read other models' profiles
- Hybrid reflection prompt: hardcoded defaults + model-shaped Reflection Preferences
- **Cloud deployment**: Azure Functions + Blob Storage with OAuth proxy to Entra ID
- **Claude.ai connector**: Custom connector with DCR (RFC 7591), OAuth authorization code flow
- **Claude Code**: Stdio server with Azure Blob Storage backend via `DefaultAzureCredential`
- **Shared profile**: Both Claude.ai and Claude Code read/write the same cloud profile
- Blob versioning enabled (automatic version history on every write)

**Design Decisions**:
- Explicit commands only for user profile (no auto-capture)
- Claude self-reflects autonomously (proactive, no user approval per-entry)
- No metadata/timestamps on user profile
- Inline dates on Claude profile Conversational History and Corrections
- Manual pruning (no decay)
- Per-model Claude profiles (multi-tenant via Entra ID OID)

**Architecture**:
```
Claude.ai / Mobile → Custom Connector → Azure Function (HTTP) → Blob Storage
Claude Code         → stdio MCP server → DefaultAzureCredential → Blob Storage
```

---

## Completed: Cloud Deployment (Phase 2)

Delivered Feb 2026. Key milestones:
- Azure Functions + Blob Storage infrastructure (Bicep IaC)
- OAuth proxy (authorize, token endpoints) to Azure Entra ID
- Dynamic Client Registration (RFC 7591) for Claude.ai
- Claude.ai custom connector working (load, reflect, save, remove)
- Claude Code switched from local file to Azure Blob Storage
- Managed identity for Functions → Storage access (RBAC)
- GitHub Actions CI/CD with OIDC authentication

---

## Phase 2: Stability & Observability

**Goal**: Make the deployed MCP server reliable and debuggable.

### Error Messaging
Currently tool errors surface as the generic "Error occurred during tool execution" in Claude.ai. We need:
- Structured error responses with error codes, descriptions, and hints
- Differentiate between auth errors, storage errors, timeout errors, and transport errors
- Log all errors with request context to Application Insights
- Surface actionable messages to the client (e.g., "Profile not found" vs "Storage unavailable")

### Implementation Priority
| Task | Effort | Impact |
|------|--------|--------|
| Better error messages in tool responses | Small | High |
| Structured logging with App Insights | Small | High |

---

## Phase 3: Profile Versioning

**Goal**: Let users view and restore previous versions of their profile.

Azure Blob Storage versioning is already enabled (`isVersioningEnabled: true` in Bicep), so every write to `me.md` automatically creates a new version. The infrastructure is in place — we just need to surface it.

### Features
- New tool: `profile_history` — list recent versions with timestamps and size
- New tool: `restore_profile` — restore a specific version by version ID
- Diff view: show what changed between versions (useful after `/reflect`)

### Implementation
- Use `BlobClient.listBlobVersions()` from `@azure/storage-blob` SDK
- Each version has a `versionId` (timestamp-based) and metadata
- Restore = copy a specific version to the current blob

### Open Questions
- How many versions to show by default? (last 10? last 30 days?)
- Should `/reflect` show a diff of what it changed?

---

## Phase 4: Time-Tiering

**Goal**: Add temporal organization like Claude.ai's memory structure

**Deferred because**: Higher risk (modifies me.md structure), lower immediate value compared to stability and versioning.

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
- Implementation: Azure AI Search

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
| 1 | Error messaging & logging | High | Low | Low |
| 2 | Profile versioning | Medium | Low | Low |
| 3 | Time-tiering | Medium | Medium | High |
| 4 | Confidence scoring | Medium | Medium | Medium |
| 5 | Semantic search | Medium | High | Low |
| 6 | Multi-profile | Medium | Medium | Low |
| 7 | Auto-reflection | Low | Low | Low |

---

## Open Questions for Future

1. **Granularity**: Should "Learned Facts" be categorized (work, personal, technical)?
2. **Privacy levels**: Some facts are shareable, others are private?
3. **Source tracking**: Note which project/session a learning came from?
4. **Export format**: Should we support exporting to other memory systems?
5. **Import from Claude.ai**: Periodic sync from Claude.ai's native memory?
