# Issue-Driven Development Workflow

> **Purpose:** Structured issue handling scaffolding - works with any development approach (BMAD, Design OS, manual, etc.)
>
> **Philosophy:** Spec first, tests before code, human verification via deployed app.

---

## TL;DR Flow

```
ISSUE -> SPEC -> TEST -> CODE -> VERIFY -> DEPLOY -> HUMAN REVIEW -> DONE
```

| Step | Who | Output | Gate |
|------|-----|--------|------|
| 1. Create Issue | Human | GitHub issue with clear goal | Clarity >= 95% |
| 2. Refine Spec | AI/Human | Acceptance criteria (max 3) | AC <= 3 or split |
| 3. Write Tests | AI/Human | Failing Playwright tests | Tests exist & fail |
| 4. Implement | AI/Human | Code that passes tests | Tests pass (GREEN) |
| 5. Verify | AI/CI | All tests green | CI passes |
| 6. Deploy | AI/Human | Deployed to web | Accessible via URL |
| 7. Human Review | Human | Test via browser | APPROVE or REJECT |
| 8. Done | AI/Human | Docs updated, merged | Closed |

---

## Phase Details

### Phase 0: Issue Creation (Human)

**Before creating an issue, answer:**
- What problem are we solving?
- What does success look like?
- How will I verify it works (without reading code)?

**Issue must include:**
- Clear title: `[type]: Brief description`
- Problem statement (1-2 sentences)
- Success criteria (what "done" looks like)

**Labels to apply:**
- `type:bug` | `type:feature` | `type:enhancement`
- `priority:critical` | `priority:high` | `priority:medium` | `priority:low`
- `area:ui` | `area:api` | `area:database`
- `workflow:full` (or `workflow:quick` for trivial)
- `phase:0-backlog`

---

### Phase 1-2: Specification

**Clarification Gate:** If requirements are <95% clear, AI must ask:
- "What does success look like?"
- "What are the acceptance criteria?"
- "What should NOT change?"
- "Any edge cases?"

**Output: Acceptance Criteria (AC)**
- Maximum 3 ACs per issue
- Each AC must be testable ("User can X" not "Improve X")
- Each AC maps to a Playwright test

**Split Gate:** If >3 ACs needed -> add `needs:split` label and break into smaller issues.

**Example ACs:**
```markdown
## Acceptance Criteria
- [ ] User can click "Add Task" button and see modal appear
- [ ] User can enter task name and save successfully
- [ ] User sees error message if task name is empty
```

---

### Phase 3: Test Writing

**TDD Requirement:** Tests are written BEFORE implementation.

**Test file naming:** `tests/issue-{number}-{slug}.spec.ts`

**Tests must:**
- Cover all acceptance criteria
- Be failing initially (RED state)
- Use Playwright for E2E testing
- Be runnable via `npm run test`

**Example test structure:**
```typescript
// tests/issue-42-add-task-modal.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Issue #42: Add Task Modal', () => {
  test('AC1: User can click Add Task and see modal', async ({ page }) => {
    await page.goto('/tasks');
    await page.click('[data-testid="add-task-btn"]');
    await expect(page.locator('[data-testid="task-modal"]')).toBeVisible();
  });

  test('AC2: User can save task successfully', async ({ page }) => {
    // ... implementation
  });

  test('AC3: Shows error for empty task name', async ({ page }) => {
    // ... implementation
  });
});
```

---

### Phase 4: Implementation

**Red-Green-Refactor:**
1. **RED:** Tests are failing (from Phase 3)
2. **GREEN:** Write minimum code to pass tests
3. **REFACTOR:** Clean up without breaking tests

**Rules:**
- Only implement what's needed to pass tests
- Follow existing patterns in codebase
- Use design system variables (no hardcoded colors)
- Reference project design standards for UI work

**Worktree (for full workflow):**
```bash
git worktree add ../{project}-wt-{slug} -b work/{number}-{slug}
```

---

### Phase 5: Automated Testing

**Run all tests:**
```bash
npm run test
```

**Outcomes:**
| Result | Action | Label Update |
|--------|--------|--------------|
| All pass | Proceed to Phase 6 | `tests:passed` |
| Any fail | Return to Phase 4 | `tests:failed-1` (increment on retry) |

**3-Strike Rule:** After `tests:failed-3+`, human review required.

---

### Phase 6: Deployment

**Deploy to staging/production:**
```bash
# Project-specific deployment
npm run build && npm run deploy
```

**Update labels:**
- Remove `phase:5-tea-testing`
- Add `phase:6-deployment`
- Add `deploy:staged` or `deploy:production`

---

### Phase 7: Human Review (Human via Browser)

**This is NOT code review.** Human tests via the deployed web app.

**Review checklist:**
- [ ] Navigate to the feature in browser
- [ ] Test each acceptance criterion manually
- [ ] Check adjacent features weren't broken
- [ ] Verify on desktop (1920x1080 minimum)

**Responses:**
- **APPROVE:** `/wf:approve {issue#}` -> moves to Phase 8
- **REJECT:** `/wf:deny {issue#} {reason}` -> returns to appropriate phase

**For UI changes, verify:**
- [ ] Hover/focus states work
- [ ] Dropdowns visible above other content
- [ ] Popups close on Escape and click-outside
- [ ] No horizontal scroll on 1920x1080

---

### Phase 8-9: Completion

**Phase 8: Documentation Update**
- Update PRD if feature changed scope
- Update design standards if new patterns introduced

**Phase 9: Merge & Cleanup**
- Merge PR to main
- Delete worktree branch
- Close issue with `resolution:fixed`

---

## Quick Path (workflow:quick)

For trivial changes only:
- Typos, one-liners, config changes
- CSS changes < 10 lines
- No new features or logic changes

**Quick path skips Phases 1-3 but still requires:**
- Phase 5: Tests pass
- Phase 7: Human verification
- Phase 9: Proper closure

---

## Label Quick Reference

### Phase Labels (mutually exclusive)
| Label | Description |
|-------|-------------|
| `phase:0-backlog` | Awaiting triage |
| `phase:1-refining` | Gathering requirements |
| `phase:2-designing` | Architecture/UX design |
| `phase:3-tests-writing` | Writing failing tests |
| `phase:4-developing` | Implementation |
| `phase:5-tea-testing` | Running automated tests |
| `phase:6-deployment` | Deployed for human testing |
| `phase:7-human-review` | Awaiting human verification |
| `phase:8-docs-update` | Documentation updates |
| `phase:9-done` | Complete |

### Next Action Labels
| Label | Who Acts | Meaning |
|-------|----------|---------|
| `next:ai-ready` | AI | Clear requirements, AI can proceed |
| `next:human-input` | Human | Blocked, needs human decision |
| `next:human-verification` | Human | Deployed, needs manual testing |
| `next:ai-testing` | AI | Ready for automated tests |

### Test Status
| Label | Meaning |
|-------|---------|
| `tests:passed` | All green |
| `tests:failed-1` | First failure |
| `tests:failed-2` | Second failure |
| `tests:failed-3+` | Needs human review |

---

## Workflow Commands

| Command | Purpose |
|---------|---------|
| `/wf:status` | Current workflow status by phase |
| `/wf:pending` | Items awaiting human approval |
| `/wf:approve #` | Approve issue, advance phase |
| `/wf:deny # reason` | Reject with feedback |
| `/wf:q` | Items ready for deployment |
| `/wf:deploy` | Deploy pending items |
| `/wf:review` | Start human review session |

---

## Integration with Development Approaches

This workflow provides the **issue scaffolding** - the structure around when things happen. It's agnostic to which system handles the actual work:

| Concern | This Workflow Handles | Your Dev Approach Handles |
|---------|----------------------|---------------------------|
| **When** | When to spec, test, code, deploy | - |
| **Who** | Human vs AI decision points | Which AI/agent does the work |
| **Gates** | Quality gates, approval flows | - |
| **What** | - | Components, patterns, tokens |
| **How** | - | Implementation details |

### Using with BMAD
- BMAD agents (Analyst, Architect, TEA, Dev) slot into phases 1-5
- Use `/bmad:*` commands to invoke agents at each phase

### Using with Design OS
- Design OS handles the design/implementation methodology
- This workflow provides the issue lifecycle around it
- Use Design OS for phases 2-4, this workflow for phases 0-1 and 5-9

### Using Manually
- Follow the phases sequentially
- Use the gates to ensure quality
- Skip agent invocations, do the work yourself

---

## Key Principles

1. **Spec before code:** Never implement without clear acceptance criteria
2. **Test before implement:** Failing tests define the contract
3. **Human verification via browser:** Not code review, actual usage
4. **Maximum 3 ACs:** More = split the issue
5. **Bug budget:** 3+ open bugs = pause features, fix bugs

---

*Version: 1.0.0*
