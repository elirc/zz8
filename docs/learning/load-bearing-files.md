# Load-Bearing Files

## prisma/schema.prisma
- What it does: Defines the tenant-owned data model and the workflow/ops tables.
- What calls it: `src/lib/db.ts`, `prisma/seed.ts`, all repository classes.
- What it calls: PostgreSQL through Prisma.
- What would break or become insecure if this file were wrong: Tenant scoping, relation integrity, or workflow persistence could collapse across the whole app.
- What a junior engineer would likely miswrite here: Leaving `tenantId` off a child table or forgetting a uniqueness/index rule that a service depends on.

## src/lib/auth/session.ts
- What it does: Converts demo headers into the authenticated application session.
- What calls it: `src/lib/http/route-context.ts`.
- What it calls: `src/lib/demo/demo-sessions.ts`, `src/lib/http/app-error.ts`.
- What would break or become insecure if this file were wrong: Every protected route could accept the wrong actor or wrong tenant.
- What a junior engineer would likely miswrite here: Parsing headers directly in every route instead of centralizing the rule once.

## src/lib/auth/permissions.ts
- What it does: Centralizes platform-role, tenant-role, and employee-context checks.
- What calls it: `src/services/employee-service.ts`, `src/services/review-service.ts`, `src/services/integration-service.ts`.
- What it calls: `src/lib/http/app-error.ts`.
- What would break or become insecure if this file were wrong: The app would start leaking writes or reads to the wrong roles.
- What a junior engineer would likely miswrite here: Adding a special-case role check in one route and never reusing it elsewhere.

## src/services/employee-service.ts
- What it does: Owns employee CRUD business rules and cross-entity validation.
- What calls it: `src/services/employeeService.ts`, then `src/app/api/employees/route.ts` and `src/app/api/employees/[employeeId]/route.ts`.
- What it calls: `src/lib/auth/permissions.ts`, `src/repositories/repository-context.ts`, `src/repositories/employee-repository.ts`, `src/repositories/audit-log-repository.ts`.
- What would break or become insecure if this file were wrong: Unauthorized employee writes, cross-tenant manager/org links, and missing audit coverage.
- What a junior engineer would likely miswrite here: Only validating the request body and skipping tenant-safe reference checks.

## src/repositories/employee-repository.ts
- What it does: Issues tenant-scoped Prisma reads and writes for employees.
- What calls it: `src/services/employee-service.ts`.
- What it calls: `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Employee directory screens and updates could leak across tenants.
- What a junior engineer would likely miswrite here: Using `update()` by global `id` instead of a tenant-scoped `updateMany()`.

## src/services/review-service.ts
- What it does: Enforces review workflow rules, especially self-review submission.
- What calls it: `src/services/reviewCycleService.ts`, then `src/app/api/review-cycles/route.ts` and `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts`.
- What it calls: `src/lib/auth/permissions.ts`, `src/repositories/repository-context.ts`, `src/repositories/review-repository.ts`, `src/repositories/audit-log-repository.ts`.
- What would break or become insecure if this file were wrong: Invalid review transitions could overwrite submissions or allow the wrong actor to submit.
- What a junior engineer would likely miswrite here: Checking only that an assignment exists, not that it is in a legal source state.

## src/repositories/review-repository.ts
- What it does: Reads review-cycle summaries and persists self-review responses transactionally.
- What calls it: `src/services/review-service.ts`.
- What it calls: `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Review responses could drift from assignment status or lose tenant ownership.
- What a junior engineer would likely miswrite here: Writing the response and assignment status separately without a transaction.

## src/services/integration-service.ts
- What it does: Controls integration job listing, retry validation, and queue processing.
- What calls it: `src/services/integrationService.ts`, then integration routes and `src/jobs/processIntegrationJobs.ts`.
- What it calls: `src/lib/auth/permissions.ts`, `src/repositories/integration-repository.ts`, `src/repositories/audit-log-repository.ts`, `src/jobs/process-queued-integration-jobs.ts`.
- What would break or become insecure if this file were wrong: Failed jobs could be retried from illegal states or worker runs could skip authorization and audit trails.
- What a junior engineer would likely miswrite here: Treating operator tooling as “internal” and skipping business-rule validation.

## src/repositories/integration-repository.ts
- What it does: Owns tenant-scoped config, job, and log persistence for integration operations.
- What calls it: `src/services/integration-service.ts`, `src/jobs/process-queued-integration-jobs.ts`.
- What it calls: `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Queue claims, retries, and logs could cross tenant boundaries.
- What a junior engineer would likely miswrite here: Forgetting that worker-side updates need the same tenant filter as request-side updates.

## src/jobs/process-queued-integration-jobs.ts
- What it does: Runs the queued-job processing loop.
- What calls it: `src/services/integration-service.ts`.
- What it calls: `claimQueuedJobs()`, `completeJob()`, and `addLog()` on the integration repository.
- What would break or become insecure if this file were wrong: Jobs could be left in inconsistent states or the worker path could stop emitting logs.
- What a junior engineer would likely miswrite here: Flipping job status without recording an operational log or terminal timestamp.

---

## Verification notes on the entries above (2026-10 docs pass)

| Entry | Claim | Verdict |
| --- | --- | --- |
| `prisma/schema.prisma` | "What calls it: ... all repository classes" | True through the generated client (`src/lib/db.ts:8`). |
| `src/lib/auth/session.ts` | "Converts demo headers into the authenticated application session" | True, with a gap: **missing** headers become an HR admin session (`session.ts:17-19`; run, test S1). The "wrong actor" risk listed is already present. |
| `src/lib/auth/permissions.ts` | "Centralizes platform-role ... checks" | `assertPlatformRole` has one call site and it can never throw (`integration-service.ts:108-119`). The real platform bypass is inside `assertTenantRole` (`permissions.ts:16`) and `assertIntegrationAccess` (`integration-service.ts:132-134`). |
| `src/services/employee-service.ts` | "cross-tenant manager/org links" are prevented | True for existence in the tenant (`employee-service.ts:107-128`). Not prevented: self-management (test G3, run) and manager cycles. |
| `src/repositories/employee-repository.ts` | tenant-scoped reads and writes | True (`employee-repository.ts:34,63,82,93,120,149`). |
| `src/services/review-service.ts` | "Invalid review transitions could overwrite submissions" is the risk if wrong | The service check still lets `APPROVED` through (`review-service.ts:68`), and the repository now catches it. Concurrent submits are now caught there too. Both cases surface as 404 (`:84-86`). Tests R1 and R5 showed the earlier behavior. |
| `src/repositories/review-repository.ts` | "persists self-review responses transactionally" | True (`review-repository.ts:105`). The transaction makes the assignment update, the response and the audit atomic, and re-checks status and identity in the `updateMany` (`:106-121`). |
| `src/services/integration-service.ts` | risk: "worker runs could skip authorization and audit trails" | Authorization: worker runs are authorized (`integration-service.ts:108-120`). Audit: worker runs **already** write no audit row; `INTEGRATION_JOB_PROCESSED` is never emitted (test J12). |
| `src/repositories/integration-repository.ts` | "Queue claims ... could cross tenant boundaries" | Tenant filters are present on every call, including the new in-transaction log and audit writes. The concurrency weakness inside one tenant (L1, L3 in request-lifecycle.md) is now closed by status- and token-conditional writes. No test exercises those predicates on this real class: the claim test uses a fake (`workflow-atomicity.test.ts:228-240`). |
| `src/jobs/process-queued-integration-jobs.ts` | risk: "Jobs could be left in inconsistent states" | Still possible: an exception mid-loop leaves claimed jobs RUNNING with no recovery (test J9). Completion and its log are two statements, so a crash between them loses the log. |

## src/lib/demo/demo-sessions.ts
- What it does: Holds the five hard-coded users, the two header names, the `localStorage` key, and `DEFAULT_DEMO_SESSION` (`demo-sessions.ts:9-55`). Builds `demoSessionOptions` for the role switcher (lines 57-63).
- What calls it: `src/lib/auth/session.ts:8-13`, `src/lib/http/client.ts:7-13`, `src/components/providers/demo-session-provider.tsx:17-22`.
- What it calls: types from `src/lib/domain.ts` only.
- What would break or become insecure if this file were wrong: this file **is** the role table. Changing `tenantRole` here changes what a user can do; the database membership rows are ignored (finding A4). Changing `DEFAULT_DEMO_SESSION` changes what every header-less request can do (finding A1).
- What a junior engineer would likely miswrite here: picking a privileged user as the default "so the demo works", which is what happened.

## src/lib/http/api-response.ts
- What it does: `ok()` (200), `created()` (201), and `handleRouteError()` (`api-response.ts:11-41`).
- What calls it: all eight route files.
- What it calls: `isAppError` from `src/lib/http/app-error.ts`; `NextResponse` from `next/server`.
- What would break or become insecure if this file were wrong: every error status in the API. Today it maps only `AppError`; Zod, JSON and Prisma errors all become 500 (finding A2; run with a stand-in).
- What a junior engineer would likely miswrite here: returning `error.message` for unknown errors, which would leak SQL or stack details. This file correctly hides them behind "Unexpected server error." (line 36).

## src/services/service-factory.ts
- What it does: Creates the four repository singletons at module load and the three service factories (`service-factory.ts:15-39`).
- What calls it: the three camelCase wrappers, `employeeService.ts`, `reviewCycleService.ts`, `integrationService.ts` (each one line).
- What it calls: the repository and service constructors.
- What would break or become insecure if this file were wrong: every route would get the wrong dependencies. It is also the only seam for swapping in test doubles at the composition level; today tests bypass it by constructing services directly (`src/tests/review-transition.test.ts:23`).
- What a junior engineer would likely miswrite here: creating repositories per request, or importing `db` directly into a service.

## src/lib/db.ts
- What it does: Builds one `PrismaClient` with the `PrismaPg` adapter and caches it on `globalThis` outside production (`db.ts:14-28`).
- What calls it: the four repository files.
- What it calls: `@prisma/client`, `@prisma/adapter-pg`.
- What would break or become insecure if this file were wrong: connection leaks during hot reload; or a silent connection to the wrong database. The fallback URL names `unison_hr` (line 16) while `docker-compose.yml:7` creates `people_control_center`.
- What a junior engineer would likely miswrite here: a hard-coded fallback URL that looks like it works. Failing fast when `DATABASE_URL` is missing would be safer.

## src/hooks/useReviewCycles.ts
- What it does: Fetches cycles and submits self-reviews (`useReviewCycles.ts:14-74`).
- What calls it: `src/components/reviews/review-cycle-panel.tsx:14-15`.
- What it calls: `apiFetch`, `useDemoSession`.
- What would break or become insecure if this file were wrong: what users believe about their review status. Lines 39-40 invent `selfAssignmentStatus` ("AVAILABLE" for any ACTIVE cycle), so the UI is wrong after a submission.
- What a junior engineer would likely miswrite here: filling a missing API field with a guess on the client instead of adding it to the API.

## src/lib/repositories/contracts.ts (not load-bearing, listed as a warning)
- What it does: Nothing at runtime. No file imports it.
- Why it is listed: it declares repository interfaces (`listQueuedJobs`, `markRunning`, `markProcessed`, `findSelfAssignment`) that do not exist in the live repositories, and an `EmployeeRecord` that conflicts with `src/repositories/repository-types.ts:16-30`. Reading it first teaches the wrong API. See docs/architecture/README.md, "The one real leftover".
