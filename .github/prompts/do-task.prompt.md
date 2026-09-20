---
description: "Execute the current task from task.md — first re-verifies that tasks marked done are genuinely done, then implements one task strictly within its scope, following rules.md. Use to work through a task.md checklist."
name: "do-task"
argument-hint: "[task id, e.g. T-2.3] (default: the current task in task.md)"
agent: "agent"
---

# /do-task — Execute one task, verified, in scope

You execute **one** task from `task.md`. Before that, you re-verify what is already marked done. You do not redesign the plan, and you do not go past the task in front of you.

## Inputs

- **Task file** — `task.md` in the workspace root (or beside the plan file if the argument is a path). If it does not exist, stop and tell the user to run `/execution` first. Do not create it.
- **Target task** — the argument if one was given (`T-2.3`), otherwise the current task (see Step 3). An argument may also be a range (`T-2.1..T-2.3`) or `verify` — if so, see **Modes** at the end.
- **Rules** — read `rules.md` and obey it. Load it from the first of these that exists: `.github/prompts/rules.md`, `rules.md`, `.github/copilot-instructions.md`, `AGENTS.md`. If none exists, say so and continue with the boundaries in this file.

## Step 0 — Read the rules first

Read `rules.md` in full, before any other work. It is binding: the lazy-senior ladder (YAGNI → already exists here → standard library → platform feature → already-installed dependency → one line → minimum code), shortest working diff, no unrequested abstractions, no new dependencies, deletion over addition, root cause over symptom, and the honest not-lazy-about list (understanding the problem, validation at trust boundaries, error handling that prevents data loss, security, accessibility, and **one runnable check** for non-trivial logic). Quote nothing back at the user; just comply.

## Step 1 — Read `task.md`

Read the whole file. Build the picture: phases, task IDs, status marks, dependencies, progress table. Do not start editing it yet.

Status marks: `[ ]` todo · `[~]` in progress · `[x]` done **and verified** · `[!]` previously marked done but verification failed.

## Step 2 — Verify the done tasks (gate — this happens before any new work)

For every task marked `[x]`, **execute its `Verify` step**. A checkbox is a claim, not evidence.

- Run the actual check: the exact command, the HTTP call with its status code, the SQL query, the file/artifact existence, the named UI observation. Read the result; do not infer it from the code.
- A task is confirmed done only if its own `Verify` now passes. Record what you ran and what you saw.
- If a `Verify` step is not runnable as written (a manual dashboard step, a permission you lack), look for the nearest live proof instead (an API call that only succeeds with that credential, the resource fetched by id). If there is genuinely no way to check, mark it **unverified** and say so plainly — never assume it passed.
- Non-destructive only. Do not run anything that destroys data, rewrites live prices/data outside the current task, or spends money to prove a point. If the only proof is destructive, report that and stop.
- Never print secrets, tokens, or full connection strings. Reference env var names, not values.
- **If any previously-done task fails verification: STOP.** Do not start the current task. Mark that task `[!]` in `task.md`, list failed vs verified vs unverified, and report the gap with the observed evidence. Re-verification is the whole point of this step — a broken foundation makes the next task fiction.

## Step 3 — Pick the current task

- If any task is `[~]`, that is the current task — resume it.
- Otherwise, the current task is the first `[ ]` task **whose `Depends on` tasks are all `[x]` and confirmed in Step 2**.
- If listed tasks are `[ ]` but their dependencies are not satisfied, report the blocked task and what blocks it. Do not jump ahead, and do not reorder `task.md` to make something available.
- A `[!]` task is the current task — fixing it comes before anything new.

State the task ID and title you are working on before you touch anything.

## Step 4 — Pre-flight: understand, then climb the ladder

Per `rules.md`, the ladder runs **after** understanding the problem, not instead of it.

1. Read every file the task names, plus its real neighbours: callers, the route handler, the schema, the config that feeds it. Trace the flow end to end before choosing an approach.
2. Look for what already exists: an existing helper, query, component, or pattern in this codebase that does this already. Reuse it.
3. Then climb the ladder and take the highest rung that holds.
4. If the task is already satisfied, is a duplicate, or the ladder shows a materially smaller path than the task describes — **stop and say so** with the reasoning. Do not silently redefine the task, and do not implement the larger version because it was written down.

## Step 5 — Implement exactly this task

- Do the task's `Do` steps. Create/edit only the files the task names, plus files that are strictly required for it to work (a route registration, an export). If extra files are truly required, name them and say why.
- Nothing adjacent: no refactors of code you happen to touch, no naming/prettifying sweeps, no new endpoints, no extra config, no new dependency, no abstraction, no defensive layer nobody asked for.
- Match the surrounding conventions — module style, error shape, naming, file layout — so the diff looks native.
- Root cause, not symptom: if the task's change fixes a reported behaviour, check the other callers of the function you touched rather than patching one path.
- If a non-trivial piece of logic lands, leave exactly **one** runnable check for it, as `rules.md` requires — the smallest thing that fails if the logic breaks, no framework, no fixtures. Trivial one-liners get none.
- Mark a deliberate corner cut with a `ponytail:` comment naming the ceiling and the upgrade path.
- **If the task is bigger than its stated 30-minute scope or needs a different design, stop and report it** rather than quietly ballooning the change. Propose splitting it in `task.md`.

## Step 6 — Verify

- Run the task's own `Verify` step, for real, and read the output.
- Prefer evidence that the outside world can see: the HTTP request and its status/body, the DB row as actually stored, the response the browser receives.
- If it fails, fix within this task's scope and re-run. If the failure reveals the task itself is wrong, stop and report instead of redesigning.
- Do not mark anything done on the strength of "the code looks right" or "it should work".

## Step 7 — Update `task.md`

- Mark `[x]` **only** after `Verify` passed. Otherwise `[~]` (in progress) or `[!]` (was done, now fails).
- Append a one-line evidence note to the task: the command/check run and the observed result. Keep it factual — this is what the next verification pass will read.
- Update the Progress table row for that phase.
- If implementing revealed a genuine new prerequisite, **add it as a new task** with a fitting ID and dependency, and say so. Do not do it now, and do not renumber existing IDs.
- Do not touch `plan.md`, and do not edit tasks other than the one you worked on (except adding a discovered prerequisite or marking a failed re-verification).

## Step 8 — Report

Short and factual:

- **Verified first:** which previously-done tasks passed, and any that failed or could not be verified.
- **This task:** ID and title.
- **Changed:** exact file paths, one line each on what changed.
- **Evidence:** the exact `Verify` command and the observed result.
- **Skipped / cut:** anything you deliberately did not build, and why (`rules.md` ladder).
- **Next:** the task ID that follows, and any blocker.

Then stop. One task per run.

## Hard boundaries — do not go beyond

- No work on any task other than the current one.
- No changes outside the files the current task names (plus strictly-required wiring, stated explicitly).
- No new dependencies, no abstractions, no config, no tests beyond the single check `rules.md` demands.
- No reordering, deleting, or rewriting tasks to make progress look cleaner.
- No editing `plan.md`, ever.
- No starting the next task "while I'm here" — even if it is a two-line fix. Note it instead.
- No `git commit`, `push`, or history rewrite unless the current task explicitly asks for it.
- If the task cannot be done as specified, that is a **finding**, not a licence to improvise. Stop and report.

## Modes

- `/do-task` — Step 2 verification pass, then the current task.
- `/do-task T-2.3` — verification pass, then that task (it must be the current task, or say why it is being jumped to).
- `/do-task T-2.1..T-2.3` — verification pass, then those tasks in order, each one verified before the next. Stop at the first failure.
- `/do-task verify` — Step 2 only: re-verify every `[x]` task and the last task's evidence, update marks, report. Change no product code.
