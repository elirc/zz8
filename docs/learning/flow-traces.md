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

**Correction:** steps 3 and 4 are in the wrong order. `POST()` calls `buildRouteContext()` first (`src/app/api/employees/route.ts:24`) and only then `createEmployeeSchema.parse()` (line 25). Also, the form in step 1 runs the same schema in the browser through `zodResolver` (`employee-directory.tsx:23-24`), so a malformed form never reaches the API; a malformed **API** call from an employee gets 500, not 403 (finding A2 in auth-and-permissions.md).

**Clarification for step 1:** the form is shown to every role, including EMPLOYEE. There is no UI role check; the 403 comes back as the mutation error.

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

**Clarification for step 6:** "claims queued jobs" is a read followed by separate per-row updates (`src/repositories/integration-repository.ts:159-208`). Each update is now conditional on `status: "QUEUED"` and stamps a `claimToken`, so two sweeps cannot both win a row, even though they read the same candidates. The race trace below shows the earlier, unconditional version.

---

## Additional flows (2026-10 docs pass)

Every step below cites the line that does the work. "(run)" marks flows that were executed in the scratch harness described in [testing-rationale.md](testing-rationale.md#checks-that-were-run-for-these-docs).

## Flow: A request with no demo headers (run)

1. Any client sends `GET /api/employees` with no `x-demo-*` headers (curl, a server component, a test that forgot them).
2. `src/app/api/employees/route.ts:14` calls `buildRouteContext(request)`.
3. `src/lib/auth/session.ts:17` reads `x-demo-user-id`, gets `null`, and substitutes `"user_hr_admin"`.
4. `session.ts:18-19` does the same for the tenant: `"tenant_northstar"`.
5. `session.ts:20` finds `demoSessions.user_hr_admin`, an `HR_ADMIN`.
6. `session.ts:26` passes: the tenant matches.
7. `employee-service.ts:30-34` passes: HR_ADMIN may view directories.
8. Returns `200` with the whole northstar directory, including compensation.

Scratch test S1 confirms steps 3-6. Fix: finding A1.

## Flow: Queue a sync job

1. `src/components/integrations/integration-operations-panel.tsx:166-183` — the "Queue sync job" button parses the textarea as JSON in the browser (`JSON.parse`, line 172). A parse error sets `payloadError` and stops (lines 173-176).
2. `src/hooks/useIntegrationOps.ts:83-96` — `useQueueIntegrationJob()` posts `{ integrationConfigId, payloadJson }` to `/api/integration-jobs`.
3. `src/app/api/integration-jobs/route.ts:24-25` — session, then `queueIntegrationJobSchema.parse()` (`integrationSchemas.ts:9-12`).
4. `src/services/integration-service.ts:55` — `assertIntegrationAccess()`.
5. `integration-service.ts:58-65` — `findConfigById()` in the tenant; 404 if missing. `isActive` is not checked (test J10, run).
6. `src/repositories/integration-repository.ts:67-86` — `createJob()` with `status: "QUEUED"` and `requestedByUserId` from the session.
7. Returns `201` via `created()` (`src/lib/http/api-response.ts:15-17`). No audit row (test J12, run).
8. `useIntegrationOps.ts:94` invalidates both dashboard queries (`invalidateDashboard`, lines 51-57).

Note (by reading): `payloadError` is never cleared after a later successful queue, so an old error message can stay on screen.

## Flow: Process a job that is set to fail (run)

1. Seeded `job_failed_workday` is FAILED with `payloadJson: { source: "manual-admin-trigger", simulateFailure: true }` (`prisma/seed.ts:390-404`).
2. Operator clicks "Retry job" (`integration-operations-panel.tsx:257-268`). The button is enabled only for FAILED/RETRY_REQUIRED (line 260), mirroring the server rule.
3. `retryJob()` -> `queueRetry()` sets QUEUED only if the job is still FAILED/RETRY_REQUIRED, and clears `errorMessage`/`startedAt`/`finishedAt`/`claimToken` (`integration-repository.ts:116-131`).
4. In the same transaction: log "Job manually queued for retry." and audit `INTEGRATION_JOB_RETRIED` (`integration-repository.ts:132-150`).
5. Operator clicks "Process queued jobs" (`integration-operations-panel.tsx:48-53`, `batchSize: 5`).
6. `claimQueuedJobs()` picks it up (oldest first, `integration-repository.ts:177`), marks it RUNNING with a new `claimToken`, and increments `attemptCount` 2 -> 3 (`:184-197`).
7. `process-queued-integration-jobs.ts:25-29` sees `simulateFailure` truthy.
8. `completeJob(..., claimToken, success: false, errorMessage: "Simulated vendor-side failure while processing queued job.")` -> FAILED (`integration-repository.ts:213-233`).
9. Because `completeJob` returned the row, `addLog(level: "ERROR", "Job failed during worker processing.")` (`process-queued-integration-jobs.ts:40-47`).
10. The job is FAILED again with `attemptCount: 3`. Because retry never edits the payload, this loop repeats forever. Test J5 ran steps 6-9 against the earlier code, where the increment happened in step 3 instead of step 6.

## Flow: Two sweeps race for the same job (the earlier code, run against an in-memory db double; now fixed)

Two requests A and B to `POST /api/integration-jobs/process` arrive together. One job `j1` is QUEUED. The table shows the **earlier** code, kept because it is the clearest picture of a check-then-act race. In the current code, step t4 is `updateMany(id: j1, status: QUEUED)` (`integration-repository.ts:184-197`). It matches no row, so B skips `j1`, and only A's claim token can complete it.

| Time | Request A | Request B | Row `j1` |
| --- | --- | --- | --- |
| t1 | `findMany(status: QUEUED)` -> `[j1]` (`integration-repository.ts:159`) | | QUEUED |
| t2 | | `findMany(status: QUEUED)` -> `[j1]` | QUEUED |
| t3 | `updateMany(id: j1)` -> RUNNING | | RUNNING |
| t4 | | `updateMany(id: j1)` -> RUNNING (no status condition, so count 1) | RUNNING |
| t5 | `completeJob(j1)` -> SUCCEEDED | | SUCCEEDED |
| t6 | `addLog("Job completed during worker processing.")` | `completeJob(j1)` -> SUCCEEDED again | SUCCEEDED |
| t7 | returns `[j1]` | `addLog(...)` again; returns `[j1]` | SUCCEEDED, 2 logs |

Test J1 reproduced this against the earlier code: both responses contained the job and two completion logs existed. The fix is described under finding L1 in request-lifecycle.md.

## Flow: Sweep crashes halfway (run)

1. Two jobs are QUEUED.
2. `claimQueuedJobs()` marks **both** RUNNING before processing either (`integration-repository.ts:182-208`).
3. `completeJob()` for the first throws (a DB error, for example).
4. The `for` loop in `process-queued-integration-jobs.ts:24` is aborted; nothing catches the error.
5. `handleRouteError()` returns 500.
6. Both jobs stay RUNNING. The next sweep ignores them (it selects QUEUED). "Retry job" is disabled in the UI (line 260) and the server would answer 409 "Current status: RUNNING" (`integration-service.ts:88-93`).

Test J9 reproduced steps 2-6 against the earlier code. The claim-token change does not alter this flow: claimed jobs still stay RUNNING with no reaper. Fix: finding L2.

## Flow: Self-review card shows the wrong state (by reading)

1. Sam submits for `cycle_2026_h1` successfully; the assignment is now SUBMITTED (`review-repository.ts:118`).
2. `useSubmitSelfReview` invalidates `["review-cycles", activeSessionId]` (`useReviewCycles.ts:70-72`).
3. `GET /api/review-cycles` returns the same cycle with tenant-wide counts and no per-user status (`review-repository.ts:34-46`).
4. `useReviewCycles.ts:39-40` sets `selfAssignmentStatus: cycle.status === "ACTIVE" ? "AVAILABLE" : cycle.status`.
5. The card (`review-cycle-panel.tsx:66`) still shows "AVAILABLE". Clicking submit again gets 409 "already been submitted" (`review-service.ts:68-70`).

Fix sketch: have `listCycles` include the caller's SELF assignment status (`where: { reviewerUserId: ctx.actorUserId, type: "SELF" }` inside the include) and stop inventing it in the hook.

## Flow: Switching the demo role

1. `src/components/shell/app-shell.tsx:84` — the select calls `setActiveSessionId(id)`.
2. `src/components/providers/demo-session-provider.tsx:54-58` — inside `startTransition`, update state and write `localStorage["hr-control-center-demo-session"]`.
3. The memoised context value (lines 49-67) gets new `headers` and `activeSessionId`.
4. Every query key includes `activeSessionId` (`useEmployees.ts:22`, `useReviewCycles.ts:18`, `useIntegrationOps.ts:63,75`), so React Query fetches fresh data per role instead of showing another role's cache.
5. On first load, the provider reads `localStorage` in its `useState` initializer (lines 38-47). On the server it returns `"user_hr_admin"` (line 40). If the stored role differs, the first client render can disagree with the server HTML (a hydration mismatch in the shell's role label). (by reading; not run)
