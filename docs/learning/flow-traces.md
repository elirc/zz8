# Flow Traces

## Flow: Employee Directory Read
1. `src/components/employees/employee-directory.tsx` — renders the table and calls `useEmployees()`.
2. `src/hooks/useEmployees.ts` — `useEmployees()` fires `GET /api/employees` through `apiFetch()`.
3. `src/lib/http/client.ts` — `apiFetch()` injects the active demo session headers.
4. `src/app/api/employees/route.ts` — `GET()` route handler.
5. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the session.
6. `src/lib/auth/session.ts` — `requireSession()` loads the actor.
7. `src/services/employeeService.ts` — `employeeService` resolves the concrete service instance.
8. `src/services/employee-service.ts` — `EmployeeService.listEmployees()` enforces `assertTenantRole()`.
9. `src/repositories/repository-context.ts` — `toRepositoryContext()` creates the tenant-aware repository context.
10. `src/repositories/employee-repository.ts` — `list()` performs the tenant-scoped Prisma query.
11. Returns `EmployeeRecord[]`.

## Flow: Unauthorized Employee Create Rejection
1. `src/components/employees/employee-directory.tsx` — submits the create form.
2. `src/hooks/useEmployees.ts` — `useCreateEmployee()` posts to `/api/employees`.
3. `src/app/api/employees/route.ts` — `POST()` validates with `createEmployeeSchema`.
4. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the actor.
5. `src/services/employeeService.ts` — `employeeService` resolves the concrete service instance.
6. `src/services/employee-service.ts` — `EmployeeService.createEmployee()` calls `assertTenantRole()`.
7. `src/lib/auth/permissions.ts` — `assertTenantRole()` throws `AppError(403, ...)`.
8. `src/lib/http/api-response.ts` — `handleRouteError()` returns the rejection payload.
9. Returns `403`.

## Flow: Self Review Submission
1. `src/components/reviews/review-cycle-panel.tsx` — submit button calls `useSubmitSelfReview()`.
2. `src/hooks/useReviewCycles.ts` — mutation posts to `/api/review-cycles/[cycleId]/submit-self-review`.
3. `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` — route handler parses params and body.
4. `src/lib/validation/reviewSchemas.ts` — `submitSelfReviewSchema.parse()`.
5. `src/services/reviewCycleService.ts` — `reviewCycleService` resolves the concrete service instance.
6. `src/services/review-service.ts` — `ReviewService.submitSelfReview()` enforces role and state-transition rules.
7. `src/repositories/repository-context.ts` — `toRepositoryContext()` creates the tenant-aware context.
8. `src/repositories/review-repository.ts` — `findSelfReviewContext()` confirms ownership, then `submitSelfReview()` performs the transaction.
9. `src/repositories/audit-log-repository.ts` — `create()` records the audit entry.
10. Returns `{ assignmentId, cycleName, submittedAt }`.

## Flow: Invalid Review Transition Rejection
1. `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` — request reaches the review route.
2. `src/services/reviewCycleService.ts` — compatibility export forwards to the concrete review service.
3. `src/services/review-service.ts` — `submitSelfReview()` loads the assignment context through `findSelfReviewContext()`.
4. `src/services/review-service.ts` — checks `assignmentStatus === "SUBMITTED"`.
5. `src/lib/http/app-error.ts` — `AppError(409, ...)` is thrown.
6. `src/lib/http/api-response.ts` — `handleRouteError()` turns it into the HTTP response.
7. Returns `409`.

## Flow: Integration Job Retry
1. `src/components/integrations/integration-operations-panel.tsx` — retry button calls `useRetryIntegrationJob()`.
2. `src/hooks/useIntegrationOps.ts` — mutation posts to `/api/integration-jobs/[jobId]/retry`.
3. `src/app/api/integration-jobs/[jobId]/retry/route.ts` — parses params and retry reason.
4. `src/lib/validation/integrationSchemas.ts` — `retryIntegrationJobSchema.parse()`.
5. `src/services/integrationService.ts` — `integrationService` resolves the concrete service instance.
6. `src/services/integration-service.ts` — `retryJob()` enforces access and status checks.
7. `src/repositories/repository-context.ts` — creates the tenant-aware repository context.
8. `src/repositories/integration-repository.ts` — `findJobById()`, `queueRetry()`, and `addLog()` perform the persistence path.
9. `src/repositories/audit-log-repository.ts` — `create()` records `INTEGRATION_JOB_RETRIED`.
10. Returns `IntegrationJobRecord`.

## Flow: Background Queue Processing
1. `src/components/integrations/integration-operations-panel.tsx` — operator clicks “Process queued jobs”.
2. `src/hooks/useIntegrationOps.ts` — `useProcessQueuedJobs()` posts to `/api/integration-jobs/process`.
3. `src/app/api/integration-jobs/process/route.ts` — validates `batchSize` and calls `runIntegrationJobSweep()`.
4. `src/jobs/processIntegrationJobs.ts` — `runIntegrationJobSweep()` delegates to `integrationService.processQueuedJobs()`.
5. `src/services/integration-service.ts` — `processQueuedJobs()` authorizes the caller and delegates to the worker function.
6. `src/jobs/process-queued-integration-jobs.ts` — claims queued jobs, completes them, and appends logs.
7. `src/repositories/integration-repository.ts` — `claimQueuedJobs()`, `completeJob()`, and `addLog()` perform the tenant-scoped writes.
8. Returns `IntegrationJobRecord[]`.
