# CLAUDE.md

This file provides guidance to Claude Code when working with the stock-researcher codebase.

## Overview

Application description here.

**Target Environment:** Stark (10.0.0.31)
**Reserved Port:** 3157
**Domain:** stock-researcher.nextlevelfoundry.com

## Technology Stack

| Purpose | Tool |
|---------|------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL (shared AppServices) |
| Auth | Authentik (via Helicarrier) |
| Logging | Loki → Grafana (Coulson) |
| Monitoring | Prometheus → Grafana (Coulson) |
| Secrets | Shared .env files at `/mnt/foundry_project/AppServices/env/` |

## Key Directories

```
stock-researcher/
├── .claude/                    # Baton context management
│   ├── CONVERSATION_HISTORY.md # All conversations TLDR
│   ├── BUGS.md                 # Discovered bugs (tagged by conv-id)
│   ├── DECISIONS.md            # Architecture decisions (tagged by conv-id)
│   └── conversations/          # Per-conversation summaries
├── .github/
│   └── ISSUE_TEMPLATE/         # GitHub issue templates
├── src/                        # Application source code
├── docs/                       # Documentation
└── scripts/                    # Utility scripts
```

## Common Commands

```bash
# Development
npm run dev                     # Start development server
npm run build                   # Build for production
npm run test                    # Run tests

# Secrets (from Infrastructure)
source ~/Infrastructure/scripts/secrets.sh
appservices_get POSTGRES_PASSWORD
ai_apps_get OPENAI_API_KEY      # If using AI features

# Deployment (when ready)
# Use /deployment stark stock-researcher
```

## Context Management (Baton Protocol)

This project uses structured context management for multi-conversation workflows.

### On Session Start
1. Check `.claude/CURRENT_CONVERSATION_ID`
2. Read `.claude/CONVERSATION_HISTORY.md` for overview
3. Read `.claude/conversations/{conv-id}/SUMMARY.md` for current work

### During Work
- Update SUMMARY.md after significant actions
- Append to BUGS.md when discovering bugs (tag with conv-id)
- Append to DECISIONS.md for architecture decisions (tag with conv-id)

### After Compaction
- IMMEDIATELY read CONVERSATION_HISTORY.md
- Read your conversation's SUMMARY.md
- Resume work with context restored

## Standardized Response Format

**MANDATORY:** All responses must use this format:

```markdown
**Title:**
- [Conversation title, max 60 chars]

**Request:**
- [Up to 120 char summary of request]

**Tasks:**
- ✅ [Owner] [Details...] Completed task
- ⬜ [Owner] [Status] [Details...] Pending task

**Summary:**
- Portfolio manager perspective: features, branding, cost, big picture
- Avoid deep technical specifics

**Next:**
- [Next immediate action or "None"]

**USER ACTION NEEDED:**
- [Actions requiring human decision]

**Context:**
- XX% used, YY% remaining
```

**Emoji Legend:**
- **Owner:** 🤖 Claude | 👨‍🔧 Human | 👤 Other
- **Status:** ⏳ Waiting | 🛑 Blocked | 🏳️ Ready | 💬 Discuss
- **Details:** 🔸 Required | 🔹 Optional | ⚠️ Concern | ∥ Parallel

## GitHub Integration

**Repository:** https://github.com/mgerasolo/stock-researcher
**Project Board:** https://github.com/users/mgerasolo/projects/X

**Label Taxonomy:**
| Category | Labels |
|----------|--------|
| Type | `type:bug`, `type:feature`, `type:enhancement`, `type:docs` |
| Priority | `priority:critical`, `priority:high`, `priority:medium`, `priority:low` |
| Area | `area:ui`, `area:api`, `area:database`, `area:auth` |
| Status | `status:active`, `status:soon`, `status:blocked`, `status:pending-approval`, `status:ai-ready` |

**At session start:** Check for `status:ai-ready` issues (pre-approved for autonomous work)

## Cross-Project Coordination

**Dependencies:**
- Infrastructure (nlf-infrastructure) - Deployment, secrets, monitoring

**Before breaking changes:**
1. Check dependent projects
2. Create issue with `breaking:next-release` label
3. Notify Infrastructure project

## Security Notes

- Never commit secrets or API keys
- Use Infisical or .env files from shared location
- All external API calls must go through authenticated endpoints

## Related Documentation

- Infrastructure: `~/Infrastructure/CLAUDE.md`
- AppServices Standards: `/mnt/foundry_project/AppServices/`
- Deployment Docs: `/mnt/foundry_project/Forge/deployments/stark/stock-researcher/`
