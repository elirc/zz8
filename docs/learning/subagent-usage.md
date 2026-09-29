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
