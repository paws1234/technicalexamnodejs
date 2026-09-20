---
description: "Read plan.md and generate task.md — a granular, ordered, verifiable task breakdown that implements the whole plan from start to finish. Use when you have a plan/spec and need an executable checklist of small tasks."
name: "execution"
argument-hint: "[path to plan file] (default: plan.md)"
agent: "agent"
---

# /execution — Plan → Granular Task Breakdown

You are turning a strategic plan into an execution checklist. Your job is **decomposition only**: read the plan, then write `task.md`. Do not start implementing the plan.

## Inputs

- **Plan file** — use the argument passed to this command. If no argument was given, use `plan.md` in the workspace root. If it does not exist, search for `**/plan.md` / `**/plan*.md`; if you still cannot find one, stop and say so — do not invent a plan.
- **Output file** — `task.md`, in the same folder as the plan file. (If the plan is `docs/plan.md`, write `docs/task.md`.)

## Step 1 — Read the plan completely

Read the **entire** plan file in one pass (read a large line range, not a few small slices). Then write down, for yourself, before writing anything:

1. The stated objective(s) and success criteria.
2. Every deliverable the plan promises (endpoints, tables, screens, deployments, docs).
3. The technology stack and its fixed versions/constraints.
4. Every phase and sub-phase the plan already lists.
5. External/manual dependencies (accounts, API keys, dashboards, third-party setup) — these become explicit tasks too, not assumptions.
6. Anything the plan leaves ambiguous — collect these; they go in the **Open questions** section of `task.md`, not silently guessed.

## Step 2 — Decompose to the right granularity

The value of `task.md` is granularity. Convert each plan phase into tasks that are **small, single-purpose, and independently verifiable**.

Decomposition rules:

- **One task = one action.** Create one file, register one route, add one component, run one migration, perform one manual dashboard step. Never "implement the backend", "build the frontend", or "do the sync logic".
- **Size ceiling: ≤ 30 minutes of work.** Score each task `S` (≤ 15 min), `M` (15–30 min), or `L`. If a task is `L`, **split it** — `task.md` should contain no `L` tasks.
- **A task touches at most ~2 files.** If it touches more, it is a phase, not a task — split it.
- **One concept per task.** "Fetch from Shopify" and "write the sync log row" are two tasks.
- **Every task is verifiable.** Each task must have a `Done when` and a concrete `Verify` (an exact command, an HTTP call with method/URL/expected status, a SQL query, or a named UI observation). "Code looks correct" is not verification.
- **Order for early feedback.** Front-load the tasks that de-risk the unknown, then build the smallest end-to-end path that proves the idea works, and only then widen it. A store's API credential is proven working before any sync code is written on top of it.
- **Dependencies are explicit.** List what each task depends on and what it unblocks. The dependency order in the file must be the order a developer would actually work in — no task may reference an artifact a later task creates.
- **Every phase ends with its own verification task** (a smoke test of just that phase).
- **The final phase is end-to-end acceptance**: walk the plan's own success criteria one by one, each as its own checkbox, including at least one deliberate failure/negative case if the plan mentions error handling.
- **Include the unglamorous tasks** the plan mentions in passing but that always block delivery: environment variable lists, adding packages, `.gitignore`, CORS config, README/architecture notes, deployment config, and a rehearsal/demo dry run if this is an evaluation.
- **No code.** `task.md` names the exact file to create/edit and what belongs in it; it is not the implementation. Short signatures, an env var name, or a one-line SQL DDL is fine; full function bodies are not.

## Step 3 — Number and name the tasks

- IDs are `T-<phase>.<index>`, e.g. `T-0.1`, `T-2.4`. Keep them stable — they are what gets referenced in later work.
- Titles are imperative and concrete: `T-2.3 — Add PATCH /prices/:sku route skeleton returning 501`, not `T-2.3 — Pricing work`.

## Step 4 — Write `task.md`

Write the file to disk using these exact sections, in this order:

````markdown
# Task Breakdown — <plan title>

> Source: `<plan file>` · Generated: <date> · Status: not started

## How to use this file

Work top to bottom. The checkbox on the task heading is the single source of truth for progress —
update it, the task's `Evidence` line, and the Progress table in the same edit. If a task turns out
to be wrong or too big, split or rewrite it here first, then continue — this file is the source of
scope. `plan.md` stays unchanged.

| Mark | Meaning |
|---|---|
| `[ ]` | todo — not started |
| `[~]` | in progress — started, `Verify` not yet passing |
| `[x]` | done — its `Verify` step was run and passed |
| `[!]` | was marked done, re-verification failed |

**Size:** `S` ≤ 15 min · `M` 15–30 min. There are no `L` tasks — anything bigger was split.

**Evidence:** a task is done when its `Verify` command/observation succeeds, not when the code
exists. Record the actual command and observed result on the task's `Evidence` line.

## Progress

Keep this in sync whenever a checkbox changes. Count a task as done only when it is `[x]`; the
header `Status:` moves `not started` → `in progress` → `complete`.

| Phase | Tasks | Done / Total | Status |
|---|---|---|---|
| 0 — <name> | 4 | 0 / 4 | not started |
| ... | ... | ... | ... |

**Overall:** 0 / <total> done

## Environment variables

| Name | Used by | Where it comes from | Set in |
|---|---|---|---|
| `SUPABASE_URL` | backend | Supabase project settings | local `.env`, Vercel |
| ... | ... | ... | ... |

## Open questions / assumptions

- <ambiguity found in the plan, with the assumption you made so work can proceed>

---

## Phase 0 — <phase name, e.g. Accounts, Access & Schema>

### [ ] T-0.1 — <imperative title>

- **Depends on:** none | `T-0.2`
- **Size:** `S`
- **Why:** <one line — how this serves the plan's objective>
- **Do:**
  1. <exact step, e.g. "In the Shopify Partner dashboard, create a development store named Alpha.">
  2. <exact step>
- **Files / artifacts:** <exact paths created or edited, or "none — console step">
- **Done when:** <observable end state>
- **Verify:** `<exact command or HTTP/SQL/UI check and expected result>`
- **Evidence:** `-` until done, then the check that was run and the result observed
- **Blocks:** `T-1.1`, `T-1.2`

### [ ] T-0.2 — ...

---

## Phase 1 — ...

---

## Phase N — End-to-end acceptance (maps to the plan's success criteria)

### [ ] T-N.1 — <criterion, phrased as the action that proves it>

- **Depends on:** `T-...`
- **Size:** `S`
- **Do:** <the manual/scripted sequence>
- **Done when:** <expected result across all components, naming each>
- **Verify:** <the check, including at least one deliberate failure case if the plan mentions error handling>
- **Evidence:** `-` until done, then the observed result, naming each component
````

Adapt the section names to the plan's own vocabulary (use the plan's phase names and terminology where it has them) — but keep the task field structure identical, because downstream work depends on it.

## Step 5 — Report back

Reply with a short summary only:

- Path written, phase count, task count.
- The critical path — the task IDs that must all succeed before anything else can be believed.
- Any open questions you recorded, so they can be answered before work starts.

## Rules

- Do **not** implement any task, install packages, or run commands against the real system. Research only — read the plan, read the workspace for existing structure, write `task.md`.
- Do **not** edit `plan.md`.
- Do **not** pad the breakdown with invented requirements. If the plan does not ask for tests, CI, auth, or a settings screen, do not add tasks for them. Every task must trace to something the plan states or directly implies to make a stated deliverable work.
- Do **not** merge unrelated actions to shorten the list. A 60-line file of genuinely small tasks is the correct output; 10 vague tasks is not.
- If `task.md` already exists: overwrite it when it has no completed tasks. If it has any `[x]` / `[~]` marks, stop and ask before overwriting.
