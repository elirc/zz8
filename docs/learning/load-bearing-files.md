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
