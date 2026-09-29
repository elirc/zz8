# Guided Reading Path

## Step 1 — src/lib/auth/session.ts
**Why read this:** Every protected request starts here.
**What to look for:** `resolveSession()` and `requireSession()` turn raw headers into an application session.
**What to trace:** Called by `src/lib/http/route-context.ts`; uses `src/lib/demo/demo-sessions.ts`.
**What a junior would likely miss:** The tenant mismatch rejection in `resolveSession()` is part of authorization, not just parsing.

## Step 2 — src/lib/auth/permissions.ts
**Why read this:** This is the shared RBAC vocabulary for the whole app.
**What to look for:** `assertTenantRole()`, `assertPlatformRole()`, and `assertEmployeeContext()`.
**What to trace:** Called by `src/services/employee-service.ts`, `src/services/review-service.ts`, and `src/services/integration-service.ts`; throws `AppError` from `src/lib/http/app-error.ts`.
**What a junior would likely miss:** UI role checks do not replace these service-layer guards.

## Step 3 — src/repositories/repository-context.ts
**Why read this:** It is the exact handoff point between auth and persistence.
**What to look for:** `toRepositoryContext()` carrying `tenantId` and `actorUserId`.
**What to trace:** Called by all three service classes; consumed by all repository classes.
**What a junior would likely miss:** Passing a whole request object into repositories would make the data layer depend on HTTP.

## Step 4 — prisma/schema.prisma
**Why read this:** The entity model tells you what the product can actually represent.
**What to look for:** `tenantId` on tenant-owned models, review workflow tables, and integration job tables.
**What to trace:** Used by `src/lib/db.ts`, `prisma/seed.ts`, and every repository class.
**What a junior would likely miss:** Missing `tenantId` on a child table becomes a long-term data leak risk.

## Step 5 — src/services/service-factory.ts
**Why read this:** It shows how the default runtime object graph is assembled.
**What to look for:** The shared repository singletons and the concrete service constructors.
**What to trace:** Called by `src/services/employeeService.ts`, `src/services/reviewCycleService.ts`, and `src/services/integrationService.ts`; instantiates repository classes.
**What a junior would likely miss:** Inconsistent dependency wiring across routes is how business behavior drifts between endpoints.

## Step 6 — src/services/employee-service.ts
**Why read this:** This is the clearest example of backend CRUD service-layer thinking in the repo.
**What to look for:** `listEmployees()`, `createEmployee()`, `updateEmployee()`, and `assertTenantReferences()`.
**What to trace:** Called by `src/services/employeeService.ts`; calls `src/lib/auth/permissions.ts`, `src/repositories/repository-context.ts`, `src/repositories/employee-repository.ts`, and `src/repositories/audit-log-repository.ts`.
**What a junior would likely miss:** Cross-entity validation for `managerId` and `orgUnitId` is part of correctness, not optional polish.

## Step 7 — src/repositories/employee-repository.ts
**Why read this:** This is the concrete tenant-scoped data access path for HRIS records.
**What to look for:** `tenantId` in every `where` clause and the mapping into `EmployeeRecord`.
**What to trace:** Called by `src/services/employee-service.ts`; calls `src/lib/db.ts`.
**What a junior would likely miss:** `updateMany()` is used here to keep tenant scoping explicit on writes.

## Step 8 — src/app/api/employees/route.ts
**Why read this:** It shows the route boundary staying thin.
**What to look for:** `buildRouteContext()`, `createEmployeeSchema.parse()`, and delegation to `employeeService`.
**What to trace:** Called by `src/hooks/useEmployees.ts`; calls `src/lib/http/route-context.ts`, `src/lib/validation/employeeSchemas.ts`, and `src/services/employeeService.ts`.
**What a junior would likely miss:** The route does not own business rules; it owns transport concerns.

## Step 9 — src/services/review-service.ts
**Why read this:** This is the clearest workflow/state-transition file in the repo.
**What to look for:** `submitSelfReview()` and the checks against cycle status and assignment status.
**What to trace:** Called by `src/services/reviewCycleService.ts`; calls `src/lib/auth/permissions.ts`, `src/repositories/repository-context.ts`, `src/repositories/review-repository.ts`, and `src/repositories/audit-log-repository.ts`.
**What a junior would likely miss:** Finding the assignment is not enough; the service still rejects the wrong workflow state.

## Step 10 — src/repositories/review-repository.ts
**Why read this:** It shows how review-specific persistence differs from simple CRUD.
**What to look for:** `findSelfReviewContext()` and the transactional `submitSelfReview()`.
**What to trace:** Called by `src/services/review-service.ts`; calls `src/lib/db.ts`.
**What a junior would likely miss:** The response upsert and assignment status update belong in one transaction.

## Step 11 — src/services/integration-service.ts
**Why read this:** It demonstrates operator tooling and async workflow control.
**What to look for:** `retryJob()`, `processQueuedJobs()`, and `assertIntegrationAccess()`.
**What to trace:** Called by `src/services/integrationService.ts`; calls `src/repositories/integration-repository.ts`, `src/repositories/audit-log-repository.ts`, and `src/jobs/process-queued-integration-jobs.ts`.
**What a junior would likely miss:** Admin/support tooling still needs status validation and audit logging.

## Step 12 — src/repositories/integration-repository.ts
**Why read this:** This is the operational data-access layer for async job state.
**What to look for:** `queueRetry()`, `claimQueuedJobs()`, `completeJob()`, and `addLog()`.
**What to trace:** Called by `src/services/integration-service.ts` and `src/jobs/process-queued-integration-jobs.ts`; calls `src/lib/db.ts`.
**What a junior would likely miss:** Queue workers still need tenant-scoped filters on claims and completions.

## Step 13 — src/jobs/process-queued-integration-jobs.ts
**Why read this:** It isolates worker-style processing from the route layer.
**What to look for:** The loop over claimed jobs and the final status/log writes.
**What to trace:** Called by `src/services/integration-service.ts`; calls integration repository methods.
**What a junior would likely miss:** Background processing should still emit logs and terminal states consistently.

## Step 14 — src/components/providers/demo-session-provider.tsx
**Why read this:** It explains how the UI can exercise different roles without mixing auth state into feature components.
**What to look for:** The localStorage-backed session selection and `useDemoSession()`.
**What to trace:** Called by `src/components/providers/app-providers.tsx`; uses `src/lib/demo/demo-sessions.ts`.
**What a junior would likely miss:** Even demo auth state deserves one source of truth.

## Step 15 — src/components/integrations/integration-operations-panel.tsx
**Why read this:** It shows the frontend staying thin even for operational actions.
**What to look for:** The `useIntegrationJobs()`, `useRetryIntegrationJob()`, and `useProcessQueuedJobs()` calls.
**What to trace:** Calls hooks in `src/hooks/useIntegrationOps.ts`, which call routes under `src/app/api/integration-jobs/`.
**What a junior would likely miss:** The panel is only orchestrating user intent; the real rules still live in services.
