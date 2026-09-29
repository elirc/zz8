# Build Journal

## Stage 1 — Product Framing
Built: the unified product shape across HRIS, performance reviews, and integration operations.
Decisions made: multi-tenancy is first-class; REST stays explicit; the app keeps a service/repository split.
Why: the requirements emphasize backend-oriented learning, business-rule-heavy CRUD, and tenant-safe authorization.

## Stage 2 — Schema And Auth Boundary
Built: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/http/route-context.ts`.
Decisions made: Prisma over Drizzle, row-level tenant ownership on domain tables, and a demo-session adapter instead of a full identity provider.
Why: Prisma keeps the relationship-heavy HR model readable, and the demo-session adapter keeps the auth path explicit without hiding the RBAC layer behind vendor setup.

## Stage 3 — Services And Repositories
Built: `src/services/employee-service.ts`, `src/services/review-service.ts`, `src/services/integration-service.ts`, plus the repository classes in `src/repositories/`.
Decisions made: permission checks live in services; tenant scope lives in repositories; audit logging is append-only through `src/repositories/audit-log-repository.ts`.
Why: this keeps the API layer thin and makes state-transition and tenant-scope logic reviewable in one place.

## Stage 4 — Routes And UI
Built: API routes under `src/app/api/`, client hooks under `src/hooks/`, and pages/panels under `src/components/` and `src/app/`.
Decisions made: compatibility wrappers in `src/services/employeeService.ts`, `src/services/reviewCycleService.ts`, and `src/services/integrationService.ts` were added instead of doing a risky rename while recovering from the interrupted build state.
Why: that let the app keep moving without another wide filesystem churn.

## Stage 5 — Recovery And Stabilization
Built: green lint, green tests, and a successful production build.
Decisions made: remove stale duplicate files where possible, then add compatibility wrappers and restore missing repository/job modules where the interrupted turn had left the repo in a split state.
Why: the safest path was to converge on one runnable architecture instead of performing a repo-wide rename during feature work.

## Major Decisions

### Decision: Make multi-tenancy first-class
Why it matters: HRIS, review, and integration data all belong to organizations, and a missing tenant boundary becomes a confidentiality bug.
Options considered:
- Single-tenant now, add tenant support later. Pro: less initial code. Con: expensive and risky rewrite later.
- Tenant scope only in routes. Pro: fewer repository parameters. Con: easy to miss on child queries and background jobs.
- Tenant scope in repository context and every repository query. Pro: explicit, reviewable, and reusable. Con: more code up front.
Choice: repository-context plus tenant-scoped repository queries.
Why this won: it keeps the boundary visible in `src/repositories/repository-context.ts` and in every repository class.
What junior/mid/senior engineers notice differently:
- Junior: sees extra plumbing.
- Mid: notices it prevents repeated ad hoc filters.
- Senior: sees it as the cheapest place to prevent systemic cross-tenant leaks.

### Decision: Use Prisma instead of Drizzle
Why it matters: the codebase is teaching relational backend engineering, not query-builder internals.
Options considered:
- Prisma. Pro: readable model-to-query mapping, good for relationship-heavy domains. Con: less SQL-native feel.
- Drizzle. Pro: explicit SQL flavor and great schema control. Con: more cognitive load for this teaching goal.
Choice: Prisma.
Why this won: `prisma/schema.prisma` stays readable for a junior-to-mid engineer tracing entity relationships.
What junior/mid/senior engineers notice differently:
- Junior: appreciates the direct schema syntax.
- Mid: notices the repository layer still keeps Prisma from leaking everywhere.
- Senior: watches for generated-client boundaries and migration ergonomics.

### Decision: Keep REST instead of tRPC
Why it matters: the docs and request traces are easier to follow when there is a concrete route boundary.
Options considered:
- REST routes. Pro: explicit lifecycle and great for ops/admin endpoints. Con: more boilerplate.
- tRPC. Pro: tight client/server typing. Con: request boundaries become less visible for this learning goal.
Choice: REST routes in `src/app/api/`.
Why this won: the project includes CRUD, rejection paths, and worker-like triggers that benefit from explicit HTTP surfaces.
What junior/mid/senior engineers notice differently:
- Junior: sees the full request lifecycle more clearly.
- Mid: notices where schemas and services attach.
- Senior: values how easy it is to review auth and transport boundaries independently.

### Decision: Use compatibility wrappers instead of a risky live rename
Why it matters: the interrupted build left two naming conventions half-present in the repo.
Options considered:
- Rename everything to one convention immediately. Pro: cleaner instantly. Con: high risk while the tree is inconsistent.
- Keep both forever. Pro: fast short-term. Con: long-term confusion.
- Add thin wrappers, stabilize, then clean later. Pro: keeps progress while preserving a single runtime path. Con: temporary duplication.
Choice: wrappers in `src/services/employeeService.ts`, `src/services/reviewCycleService.ts`, and `src/services/integrationService.ts`.
Why this won: it got the repo back to lint/test/build green faster and more safely.
What junior/mid/senior engineers notice differently:
- Junior: may see duplication and stop there.
- Mid: notices it is an intentional stabilization technique.
- Senior: recognizes this as controlled technical debt with a clear migration target.

## PR Slices

### Slice 1 — Schema, Auth, And Shared Boundaries
Purpose: establish the domain model and the global request/auth infrastructure.
Novel files: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/http/route-context.ts`, `src/lib/db.ts`
Reviewer focus:
- `prisma/schema.prisma` — verify `tenantId` coverage and relationship integrity.
- `src/lib/auth/session.ts` — verify tenant mismatch rejection and default demo actor behavior.
- `src/lib/auth/permissions.ts` — verify tenant and platform roles stay separate.
Stronger reviewer flag: a missing tenant-bound child table would look harmless now but become a future leak.

### Slice 2 — Employee CRUD Backbone
Purpose: ship the HRIS employee flow with explicit service and repository boundaries.
Novel files: `src/services/employee-service.ts`, `src/repositories/employee-repository.ts`, `src/app/api/employees/route.ts`, `src/app/api/employees/[employeeId]/route.ts`
Reviewer focus:
- `src/services/employee-service.ts` — verify `assertTenantReferences()` before writes.
- `src/repositories/employee-repository.ts` — verify every query is tenant-scoped.
- `src/app/api/employees/route.ts` — verify Zod parsing happens before the service call.
Stronger reviewer flag: global foreign keys like `managerId` still need same-tenant existence checks.

### Slice 3 — Review Workflow
Purpose: add the review-cycle read model and self-review submission path.
Novel files: `src/services/review-service.ts`, `src/repositories/review-repository.ts`, `src/app/api/review-cycles/route.ts`, `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts`
Reviewer focus:
- `src/services/review-service.ts` — verify cycle and assignment status guards.
- `src/repositories/review-repository.ts` — verify the transactional submission write path.
- `src/tests/review-transition.test.ts` — verify the rejection path is pinned.
Stronger reviewer flag: checking only that an assignment exists is not the same as validating a legal transition.

### Slice 4 — Integration Operations And Background Processing
Purpose: add retry, logs, and queued-job processing for the ops console.
Novel files: `src/services/integration-service.ts`, `src/repositories/integration-repository.ts`, `src/jobs/process-queued-integration-jobs.ts`, `src/app/api/integration-jobs/route.ts`, `src/app/api/integration-jobs/[jobId]/retry/route.ts`, `src/app/api/integration-jobs/process/route.ts`, `src/app/api/integration-configs/route.ts`
Reviewer focus:
- `src/services/integration-service.ts` — verify retryable states and platform-vs-tenant access.
- `src/repositories/integration-repository.ts` — verify claim/retry/complete operations stay tenant-scoped.
- `src/jobs/process-queued-integration-jobs.ts` — verify queued jobs always end in a logged terminal state.
Stronger reviewer flag: worker paths need the same tenant filters as request paths.

### Slice 5 — UI, Testing, And Recovery Cleanup
Purpose: finish the operator UI, tests, and stabilize the repo after the interrupted turn left duplicate paths behind.
Novel files: `src/components/employees/employee-directory.tsx`, `src/components/reviews/review-cycle-panel.tsx`, `src/components/integrations/integration-operations-panel.tsx`, `src/hooks/useEmployees.ts`, `src/hooks/useReviewCycles.ts`, `src/hooks/useIntegrationOps.ts`, `src/tests/*.test.ts`
Reviewer focus:
- `src/components/providers/demo-session-provider.tsx` — verify session switching stays isolated from feature logic.
- `src/hooks/useEmployees.ts` and peers — verify cache invalidation follows mutations.
- `src/tests/auth-permissions.test.ts` — verify the route-level 403 path is exercised.
Stronger reviewer flag: compatibility wrappers are acceptable only because they are documented and the runtime path is stable again.
