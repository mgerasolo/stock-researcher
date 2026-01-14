# CLAUDE.md

This file provides guidance to Claude Code when working with the stock-researcher codebase.

---

## ⚠️ CRITICAL - READ FIRST

### Deployment Target: Banner (10.0.0.33)

**NEVER use localhost for deployment.** This application deploys to Banner, not your local machine.

| Service | Host | Port | Full Address |
|---------|------|------|--------------|
| Database (PostgreSQL) | Banner | 3380 | `10.0.0.33:3380` |
| Backend API | Banner | 3381 | `10.0.0.33:3381` |
| Frontend | Banner | 3382 | `10.0.0.33:3382` |
| Domain | - | - | `stock-researcher.nextlevelfoundry.com` |

### Database Location

The PostgreSQL database runs **ON BANNER**, not localhost:
- **Host:** `10.0.0.33` (internal) or `db` (from within Docker network)
- **Port:** `3380` (external) / `5432` (internal)
- **Connection string:** `postgresql://postgres:PASSWORD@10.0.0.33:3380/stock_researcher`

### What NOT To Do

- ❌ `DB_HOST=localhost` - WRONG
- ❌ `docker-compose up` (auto-merges override file with localhost)
- ❌ Saving data to local PostgreSQL
- ❌ Using `http://localhost:*` URLs in production code

### What TO Do

- ✅ `DB_HOST=db` (within Docker) or `DB_HOST=10.0.0.33` (external)
- ✅ `docker-compose -f docker-compose.yml up -d` (production)
- ✅ Connect to Banner database at `10.0.0.33:3380`
- ✅ Use `https://stock-researcher.nextlevelfoundry.com` for production URLs

### Default Assumptions - DO NOT ASK

**ALWAYS assume Banner deployment.** Do not ask the user how they're running the server or where they're deploying. The answer is always Banner.

### Auto-Deploy After Code Changes

**When you modify code, YOU deploy it.** Do not ask the user to restart services manually.

After changing backend code (server/):
```bash
docker-compose -f docker-compose.yml up -d --build server
```

After changing frontend code (client/):
```bash
docker-compose -f docker-compose.yml up -d --build client
```

After changing both or infrastructure:
```bash
docker-compose -f docker-compose.yml up -d --build
```

**This is YOUR responsibility as the agent.** Complete the full cycle:
1. Make code changes
2. Rebuild and deploy to Banner
3. Verify the change is live
4. Report success to user

**Do NOT:**
- ❌ Ask user to restart services
- ❌ Tell user to run docker-compose commands
- ❌ Leave changes undeployed
- ❌ Say "you'll need to restart the server"

**Questions you should NEVER ask:**
- ❌ "How are you running the server?"
- ❌ "Are you using Docker or running locally?"
- ❌ "Where is your database?"
- ❌ "What's your deployment target?"
- ❌ "Can you restart the server?"

**The answers are documented above. Just do the work.**

---

## Overview

Stock seasonality analysis tool with interactive heatmaps showing historical monthly performance patterns.

**Target Environment:** Banner (containerized)
**Domain:** stock-researcher.nextlevelfoundry.com

## Technology Stack

| Purpose | Tool | Location |
|---------|------|----------|
| Frontend | React + Vite | Banner:3382 |
| Backend | Node.js + Express | Banner:3381 |
| Database | PostgreSQL 16 | Banner:3380 |
| Auth | Authentik | Helicarrier |
| Logging | Loki → Grafana | Coulson |
| Monitoring | Prometheus → Grafana | Coulson |
| Deployment | Docker Compose | Banner |

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
├── client/                     # React frontend
├── server/                     # Express backend
├── data-pipeline/              # Stock data import scripts
├── docs/                       # Documentation
│   ├── DEPLOYMENT.md           # How to deploy to Banner
│   └── DATABASE.md             # Database location and access
└── scripts/                    # Utility scripts
```

## Docker Compose Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `docker-compose.yml` | **Production** - Binds to Banner (10.0.0.33) | Deploying to Banner |
| `docker-compose.local.yml` | Local dev database only | Local development |
| `docker-compose.local-override.example.yml` | Full local stack template | Copy and customize for local |

> ⚠️ **WARNING:** Never use `docker-compose up` alone - it may auto-merge override files with localhost bindings. Always specify the file explicitly.

## Common Commands

```bash
# === DEVELOPMENT (local) ===
# Option 1: Local services without Docker
cd server && npm run dev
cd client && npm run dev

# Option 2: Local with Docker (explicit file)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up

# === PRODUCTION (Banner) ===
# Deploy to Banner
docker-compose -f docker-compose.yml up -d

# View logs on Banner
docker-compose -f docker-compose.yml logs -f

# === SECRETS ===
source ~/Infrastructure/scripts/secrets.sh
appservices_get POSTGRES_PASSWORD
ai_apps_get OPENAI_API_KEY      # If using AI features
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

## Development Workflow

This project uses the Issue-Driven Development workflow with 10 phases and TDD.

### Workflow Types

| Type | When to Use | Labels |
|------|-------------|--------|
| **Full** | Features, complex bugs, UI changes | `workflow:full` |
| **Quick** | Typos, one-liners, config | `workflow:quick` |

### Phase Flow (10 Phases)

| Phase | Label | Description |
|-------|-------|-------------|
| 0 | `phase:0-backlog` | Awaiting triage |
| 1 | `phase:1-refining` | Gathering requirements |
| 2 | `phase:2-designing` | Architecture/UX design |
| 3 | `phase:3-tests-writing` | Writing failing tests (TDD) |
| 4 | `phase:4-developing` | Implementation |
| 5 | `phase:5-tea-testing` | Running automated tests |
| 6 | `phase:6-deployment` | Deployed for human testing |
| 7 | `phase:7-human-review` | Awaiting human verification |
| 8 | `phase:8-docs-update` | Documentation updates |
| 9 | `phase:9-done` | Complete |

### ⚠️ Issue Creation - MUST Complete Phases 0→3

**When creating ANY new issue (via `/wf issue` OR `gh issue create`), you MUST walk through phases 0→3 in the same session.**

Context lives in your head until it's written to GitHub + test files. Do NOT create an issue and leave it at phase 0.

**Required steps for every new issue:**
1. **Phase 0 - Create:** Write initial description with problem statement
2. **Phase 1 - Refine:** Ask clarifying questions, document decisions in issue comments
3. **Phase 2 - Design:** Add UI mockups, architecture notes, data flow
4. **Phase 3 - Tests:** Write failing test cases in `tests/issue-{number}-*.spec.ts`

**Only after phase 3 is the issue "parked safely" for future sessions or `/wf marathon`.**

❌ **WRONG:** Create issue → leave at phase 0 → move on
✅ **RIGHT:** Create issue → refine → design → write tests → THEN move on

### Clarification Gate (Phase 0)
When receiving a new issue/goal, if clarity < 95%, ASK:
- "What does success look like?"
- "What are the acceptance criteria?"
- "What should NOT change?"
Do NOT start work until the goal is crystal clear.

### AC Split Gate (Phases 1-2)
If >3 acceptance criteria -> Apply `needs:split` label and split before proceeding.

### Testing Gate (Phase 5)
- PASS -> Move to `phase:6-deployment`
- FAIL -> Apply `tests:failed-N`, return to `phase:4-developing`

### Human Review Gate (Phase 7)
Human tests via deployed web app:
- APPROVED -> Move to `phase:8-docs-update`
- REJECTED -> Return to appropriate phase with feedback

### TDD Requirements (Non-Quick)
1. Tests written BEFORE implementation (Phase 3)
2. Tests failing when committed (RED)
3. Implementation makes tests pass (GREEN)
4. Test file: `tests/issue-{number}-{slug}.spec.ts`

### Worktree Management
```bash
git worktree add ../stock-researcher-wt-{slug} -b work/{number}-{slug}
.claude/worktrees/{slug}/state.json  # State tracking
git worktree remove ../stock-researcher-wt-{slug}  # Cleanup
```

### Quick Path Criteria
Use `workflow:quick` ONLY for: typos, one-liners, config, CSS < 10 lines.
Quick path: Skip phases 1-3, still requires phases 5-9.

### /wf Commands (space syntax for Cursor compatibility)
| Command | Purpose |
|---------|---------|
| `/wf help` | List all workflow commands with descriptions |
| `/wf status` | Current workflow status by phase |
| `/wf open` | All open issues with summary and scope (multi-row format) |
| `/wf pending` | List items awaiting human approval |
| `/wf human` | Detailed view of items needing human review |
| `/wf approve #` | Approve issue by number, advance to next phase |
| `/wf deny # {reason}` | Reject issue with feedback, return to prior phase |
| `/wf audit` | Audit recent completions |
| `/wf dash` | GitHub dashboard links |
| `/wf issue` | Create new issue (MUST complete phases 0→3 in session) |
| `/wf incomplete` | ⚠️ Check for orphaned issues in phases 0-2 (SESSION BLOCKER) |
| `/wf q` | Items fixed but not deployed |
| `/wf deploy` | Deploy pending fixes |
| `/wf review` | Human review session |
| `/wf marathon` | Process all AI-ready issues autonomously |

> Both `/wf status` and `/wf:status` work. Space syntax recommended for Cursor IDE.

**Conversational Alternatives:**
- "approve 42" or "looks good on #42" -> `/wf:approve 42`
- "reject 42 needs more work on styling" -> `/wf:deny 42 needs more work on styling`
- "what needs my review?" -> `/wf:pending`

### Bug Budget Rule
**If 3+ bugs are open, stop new features and fix bugs first.**

### ⛔ Session-End Checkpoint (MANDATORY)

**Before ending ANY session, Claude MUST verify no issues are orphaned in transient phases.**

Phases 0-2 are **TRANSIENT** - context lives in your head until it's written to GitHub + test files. Compaction will destroy this context. Issues in these phases cannot be processed by `/wf:marathon`.

**Run this check before ending:**
```bash
gh issue list -l "phase:0-backlog" --json number,title
gh issue list -l "phase:1-refining" --json number,title
gh issue list -l "phase:2-designing" --json number,title
```

**If ANY issues found in phases 0-2:**
1. **DO NOT END THE SESSION**
2. Complete each issue to phase:3-tests-writing, OR
3. Close with reason: `gh issue close # -c "Incomplete - will recreate when ready"`

**Phase stability:**
| Phase | Status | Can End Session? |
|-------|--------|------------------|
| 0-2 | ❌ TRANSIENT | NO - finish to phase 3 first |
| 3+ | ✅ STABLE | YES - context is persisted |

---

## GitHub Integration

**Repository:** https://github.com/mgerasolo/stock-researcher

**Label Taxonomy (43 labels):**
| Category | Labels |
|----------|--------|
| Phase | `phase:0-backlog` through `phase:9-done` (10 phases) |
| Workflow | `workflow:full`, `workflow:quick` |
| Type | `type:bug`, `type:feature`, `type:enhancement`, `type:docs` |
| Priority | `priority:critical`, `priority:high`, `priority:medium`, `priority:low` |
| Area | `area:ui`, `area:api`, `area:database`, `area:auth` |
| Tests | `tests:passed`, `tests:failed-1`, `tests:failed-2`, `tests:failed-3+` |
| Deploy | `deploy:pending`, `deploy:staged`, `deploy:production` |
| Needs | `needs:verification`, `needs:demo`, `needs:split` |
| Status | `status:blocked` |
| Resolution | `resolution:fixed`, `resolution:no-longer-needed`, `resolution:deprioritized`, `resolution:replaced` |
| Next Action | `next:ai-ready`, `next:human-input`, `next:human-verification`, `next:ai-testing` |

**Next Action Labels (AI Workflow Readiness):**
| Label | Meaning | Who Acts |
|-------|---------|----------|
| `next:ai-ready` | Clear requirements - AI can work autonomously | AI |
| `next:human-input` | Blocked - needs human clarification/decision | Human |
| `next:human-verification` | Coded - needs human to test via web | Human |
| `next:ai-testing` | Implementation done - AI needs to run tests | AI |

**At session start:** Check for `phase:7-human-review` issues (awaiting human approval via web)

## Cross-Project Coordination

**Dependencies:**
- Infrastructure (nlf-infrastructure) - Deployment, secrets, monitoring

**Before breaking changes:**
1. Check dependent projects
2. Create issue with `breaking:next-release` label
3. Notify Infrastructure project

## Docker Compose Requirements

Per `AppServices/Standards-v2/shared/Containers/compose-conventions.md`:
- Bind ports to specific host IP: `"10.0.0.33:{port}:{container_port}"`
- Memory limits REQUIRED: `mem_limit: 1g`, `memswap_limit: 2g`
- Use `restart: unless-stopped`
- Named volumes with service prefix
- Set `TZ=America/New_York`

### Port Assignments (Banner)

| Service | External Port | Internal Port |
|---------|---------------|---------------|
| PostgreSQL | 3380 | 5432 |
| Backend API | 3381 | 3157 |
| Frontend | 3382 | 80 |

## Security Notes

- Never commit secrets or API keys
- Use Infisical or .env files from shared location
- All external API calls must go through authenticated endpoints
- Database password from: `appservices_get POSTGRES_PASSWORD`

## Related Documentation

- Infrastructure: `~/Infrastructure/CLAUDE.md`
- AppServices Standards: `/mnt/foundry_project/AppServices/`
- **Workflow Reference:** `docs/ISSUE_WORKFLOW.md` (full workflow documentation)
- Deployment Docs: `docs/DEPLOYMENT.md` (this repo)
- Database Docs: `docs/DATABASE.md` (this repo)
