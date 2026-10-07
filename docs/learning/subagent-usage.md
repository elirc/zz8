# Subagent Usage

## Why Subagents Helped

Two subagents were used because the repo started in an interrupted, partially-created state and there were safe parallel tasks that did not need to block the main code path:

- An explorer agent produced an architecture memo about domain entities, route groups, and multi-tenant risks.
- A worker agent produced a documentation outline so the final docs could be filled against real files instead of invented structure.

## What Each Subagent Owned

- `Boyle` (explorer)
  - Owned read-only architecture analysis.
  - Returned the entity map, module-boundary suggestions, route-group recommendations, and risk areas around tenant scoping and permissions.
  - Influence on final code/docs: reinforced the decision to keep multi-tenancy first-class and helped shape `docs/architecture/domain-model.md` and `docs/architecture/README.md`.

- `Arendt` (worker)
  - Owned read-only documentation planning.
  - Returned the doc inventory, what evidence each doc should pull from, and the recommendation to add a separate subagent-usage doc.
  - Influence on final code/docs: directly informed the structure of `docs/architecture/*`, `docs/learning/*`, and this file.

## How Outputs Were Validated Before Use

- Neither subagent was allowed to edit production files.
- Their outputs were treated as planning input only.
- Final decisions were accepted only after they matched the actual files that survived lint, tests, and build.

## Where Subagents Were Worth It

- Architecture analysis was parallelizable because it depended only on reading the codebase.
- Documentation planning was parallelizable because it could prepare the doc structure while the main thread implemented and stabilized the app.

## Where Subagents Were Not Used

- Core schema, service, repository, route, and test edits stayed in the main thread.
- The interrupted-turn cleanup and runtime stabilization also stayed in the main thread because that work was tightly coupled and easy to conflict on if split further.

---

## What can and cannot be checked in this file (2026-10 docs pass)

This file describes process, not code, so most of it cannot be verified from the repository. The table separates the two.

| Claim | Checkable? | Result |
| --- | --- | --- |
| Two subagents named `Boyle` and `Arendt` were used | No. There is one commit in history (`Import zz8 from Organized Desktop`) and no transcript in the repo. | Taken on trust. |
| The subagents' outputs shaped `docs/architecture/*` and `docs/learning/*` | Partly. The structure they describe exists: four architecture docs and seven learning docs, including a separate subagent-usage doc. | Consistent. |
| "Neither subagent was allowed to edit production files" | No. | Taken on trust. |
| "Final decisions were accepted only after they matched the actual files that survived lint, tests, and build" | Partly. The docs match the files in their structure and naming, but several claims did not match behavior: `TenantMembership` as the source of roles, a `CalibrationSession` link in `review-repository.ts`, `MappingRule` usage in `integration-repository.ts`, and "queued jobs always end in a logged terminal state". These are marked **Correction** in domain-model.md and audited in build-journal.md. Lint, tests and build could not be re-run (no dependencies installed). | Not fully. Matching file names is a weaker check than matching behavior. |
| The explorer's risk areas were "tenant scoping and permissions" | Consistent with the code. Tenant scoping turned out solid in the repositories; the bigger gaps are the header-based identity default and missing concurrency guards (the job-claim, retry and self-review guards have since been added; see request-lifecycle.md L1, L3, L4). | See auth-and-permissions.md and request-lifecycle.md. |

## Lesson for future doc work on this repo

The original docs were accurate about **where** things live and less accurate about **what they do**. Read-only planning agents are good at the first and need execution to get the second. The 2026-10 pass closed that gap by running the pure service and repository logic against in-memory doubles (38 checks, all listed in testing-rationale.md). Any future agent writing docs here should do the same before asserting runtime behavior, and should label each claim "(run)" or "(by reading)".
