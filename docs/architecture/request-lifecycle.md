# Request Lifecycle

Request: List employees for the active tenant
1. `src/app/api/employees/route.ts` — `GET()` builds request context and forwards to the employee service.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the authenticated session.
3. `src/lib/auth/session.ts` — `requireSession()` and `resolveSession()` load the acting demo user and tenant.
4. `src/services/employeeService.ts` — `employeeService` compatibility export resolves to the concrete service instance from the factory.
5. `src/services/employee-service.ts` — `EmployeeService.listEmployees()` enforces `assertTenantRole()`.
6. `src/repositories/repository-context.ts` — `toRepositoryContext()` converts the session to `{ tenantId, actorUserId }`.
7. `src/repositories/employee-repository.ts` — `list()` issues the tenant-scoped Prisma query.
8. Returns `200` with `{ data: EmployeeRecord[] }`.

**Clarification:** `listEmployees(session, search?)` and `list(ctx, search?)` support a case-insensitive search (`employee-repository.ts:35-44`), and the hook sends `?search=` when given one (`src/hooks/useEmployees.ts:36`). But `GET()` never reads the query string; it calls `listEmployees(session)` with no second argument (`src/app/api/employees/route.ts:15`). Search is dead end to end (by reading). No component passes a search value either (`employee-directory.tsx:21`).

Request: Submit a self review
1. `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` — `POST()` parses the route param and validates the body with `submitSelfReviewSchema`.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` loads the authenticated session.
3. `src/lib/validation/reviewSchemas.ts` — `submitSelfReviewSchema.parse()` enforces the input boundary.
4. `src/services/reviewCycleService.ts` — `reviewCycleService` compatibility export resolves the concrete review service instance.
5. `src/services/review-service.ts` — `ReviewService.submitSelfReview()` enforces role checks and workflow-state checks.
6. `src/repositories/repository-context.ts` — `toRepositoryContext()` supplies the tenant-aware repository scope.
7. `src/repositories/review-repository.ts` — `findSelfReviewContext()` verifies assignment ownership. Then `submitSelfReview()` (`:91-156`) runs one transaction: a conditional `updateMany` claims the assignment, then it creates the response.
8. Inside that same transaction, `tx.auditLog.create()` records `REVIEW_SUBMITTED` (`review-repository.ts:137-149`). This is not `AuditLogRepository`.
9. Returns `200` with `{ data: { assignmentId, cycleName, submittedAt } }`.

**Correction (ordering):** in the code, the session is built **first** (`submit-self-review/route.ts:17`), then the param is awaited (line 18), then the body is parsed (line 19). Step 1 above describes the whole handler; steps 2 and 3 are the real order. This matters: an unknown user gets 401 even with a broken body.

**Clarification:** the audit write in step 8 is inside the step 7 transaction, so if the audit insert fails, the assignment update and the response roll back too (test: `does not commit a self-review assignment when its audit insert fails`, `src/tests/workflow-atomicity.test.ts:165`). An earlier version wrote the audit from `review-service.ts` after the transaction had committed.

Request: Retry a failed integration job
1. `src/app/api/integration-jobs/[jobId]/retry/route.ts` — `POST()` parses the job id and validates the retry reason.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the acting session.
3. `src/lib/validation/integrationSchemas.ts` — `retryIntegrationJobSchema.parse()` validates the operator input.
4. `src/services/integrationService.ts` — `integrationService` compatibility export resolves the concrete service instance.
5. `src/services/integration-service.ts` — `IntegrationService.retryJob()` checks tenant/platform access and the current job status.
6. `src/repositories/repository-context.ts` — `toRepositoryContext()` supplies tenant scope.
7. `src/repositories/integration-repository.ts` — `findJobById()`, then `queueRetry()` (`:111-156`), which in one transaction re-queues the job only if it is still FAILED or RETRY_REQUIRED and writes the retry log.
8. In the same transaction, `tx.auditLog.create()` records `INTEGRATION_JOB_RETRIED` (`integration-repository.ts:141-150`).
9. Returns `200` with `{ data: IntegrationJobRecord }`.

**Clarification:** the status check in step 5 is repeated as a `status` condition in `queueRetry`'s `where` (`integration-repository.ts:116-121`), so of two retries that arrive together, only one re-queues the job. The other gets 404 (finding L3 below). The three writes (job update, log, audit) now share one transaction.

Request: Reject an employee user trying to create another employee
1. `src/app/api/employees/route.ts` — `POST()` validates the body and forwards to the employee service.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the session.
3. `src/lib/auth/session.ts` — `requireSession()` loads the `EMPLOYEE` actor from the demo headers.
4. `src/services/employeeService.ts` — `employeeService` compatibility export resolves the concrete service instance.
5. `src/services/employee-service.ts` — `EmployeeService.createEmployee()` calls `assertTenantRole()`.
6. `src/lib/auth/permissions.ts` — `assertTenantRole()` throws `AppError(403, ...)`.
7. `src/lib/http/api-response.ts` — `handleRouteError()` converts the `AppError` into JSON.
8. Returns `403` with `{ error: { message } }`.

**Correction (ordering, and a consequence):** the order in `src/app/api/employees/route.ts:24-26` is session (line 24), then body parse (line 25), then service and role check (line 26). So the body is validated **before** the role check, not before the session. The consequence: an `EMPLOYEE` who sends an **invalid** body gets **500** from the Zod error (finding A2 in auth-and-permissions.md) instead of 403. Only a valid body reaches the 403. That is exactly why `src/tests/auth-permissions.test.ts:22-33` sends a fully valid payload. (by reading the order; the 500 mapping was run with a stand-in.)

---

## The remaining routes

### GET a single employee

1. `src/app/api/employees/[employeeId]/route.ts:20` builds the session.
2. Line 21 awaits `params` (a `Promise` in this Next.js version, lines 12-16).
3. Line 22 calls `employeeService.getEmployee(session, employeeId)`.
4. `employee-service.ts:40-44` admits TENANT_ADMIN, HR_ADMIN, MANAGER.
5. `employee-repository.ts:60-77` runs `findFirst({ where: { tenantId, id } })` with manager and org unit included.
6. `null` becomes `AppError(404, "Employee not found.")` (`employee-service.ts:51-53`).
7. Returns `200 { data: EmployeeRecord }`.

### PATCH an employee

1. `[employeeId]/route.ts:31-33`: session, params, `updateEmployeeSchema.parse`.
2. The schema allows only `title`, `status`, `compensationCents`, `managerId`, `orgUnitId`, all optional, and refuses an empty object (`employeeSchemas.ts:27-38`).
3. `employee-service.ts:84` admits TENANT_ADMIN, HR_ADMIN.
4. `assertTenantReferences` counts the manager and org unit in the tenant (`employee-service.ts:107-128`); a miss is 400.
5. `employee-repository.ts:147-153` runs `updateMany({ where: { tenantId, id }, data: input })`. If `count === 0`, returns `null` and the service throws 404 (`employee-service.ts:91-93`).
6. The repository re-reads the row (`employee-repository.ts:159`).
7. Audit `EMPLOYEE_UPDATED` with the list of field names (`employee-service.ts:95-102`).
8. Returns `200 { data: EmployeeRecord }`.

Notes (by reading): the PATCH body cannot clear a manager or org unit, because the schema only accepts a non-empty string (`employeeSchemas.ts:22-23`), not `null`. No UI calls this route: `useUpdateEmployee` (`src/hooks/useEmployees.ts:68-89`) is exported but no component imports it.

### GET review cycles

1. `review-cycles/route.ts:13-14`: session, then `reviewCycleService.listCycles(session)`.
2. `review-service.ts:27-31` admits everyone except INTEGRATION_ADMIN.
3. `review-repository.ts:18-32` returns **every cycle in the tenant** with three counts, ordered by `startDate` desc.
4. Returns `200 { data: ReviewCycleOverview[] }`.

**Mismatch with the UI (by reading):** the route's header comment warns against "returning every assignment in the cycle instead of the actor-specific slice" (`review-cycles/route.ts:5`), and the Reviews panel says "The API only returns the acting employee's self-review context and goal count" (`review-cycle-panel.tsx:37`). Neither is true. The response has no per-actor data. The counts are tenant-wide (`reviewAssignments` counts everyone's assignments). The hook then fabricates `selfAssignmentStatus: "AVAILABLE"` for any ACTIVE cycle (`useReviewCycles.ts:39-40`), so after Sam submits, the card still says AVAILABLE.

### List configs and list jobs

- `integration-configs/route.ts:13-14` -> `listConfigs` (`integration-service.ts:38-41`) -> `findMany({ where: { tenantId }, orderBy: { name: "asc" } })` (`integration-repository.ts:18-25`).
- `integration-jobs/route.ts:14-15` -> `listJobs` (`integration-service.ts:43-46`) -> newest **20** jobs with config, requester, and the newest **3** logs each (`integration-repository.ts:36-57`). Older jobs are not reachable through the API at all; there is no pagination.

### Queue a job

1. `integration-jobs/route.ts:24-26`: session, `queueIntegrationJobSchema.parse` (`integrationSchemas.ts:9-12`: `integrationConfigId` non-empty string, `payloadJson` any object, default `{}`).
2. `integration-service.ts:55` access check.
3. `findConfigById` in the tenant (`integration-repository.ts:27-34`); missing is 404 (`integration-service.ts:63-65`).
4. `createJob` inserts `status: "QUEUED"` with `requestedByUserId: session.userId` (`integration-repository.ts:67-86`).
5. Returns **201** `{ data: job }` via `created()` (`api-response.ts:15-17`).

Not checked: `config.isActive` (test J10, run, queues a job on a paused config). Not written: any audit row (test J12, run).

### Process queued jobs (the sweep)

1. `process/route.ts:14-16`: session, `processQueuedJobsSchema.parse` (`batchSize` coerced to an integer 1-20, default 5; `integrationSchemas.ts:18-20`), then `runIntegrationJobSweep(session, input)`.
2. `src/jobs/processIntegrationJobs.ts:14` forwards to `integrationService.processQueuedJobs`.
3. `integration-service.ts:108-120`: tenant admins and integration admins pass `assertTenantRole`; platform admin/support pass the (no-op) `assertPlatformRole`.
4. `process-queued-integration-jobs.ts:17-20` calls `claimQueuedJobs(ctx, batchSize)`:
   - `findMany({ where: { tenantId, status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: batchSize })` (`integration-repository.ts:159-179`);
   - then, one row at a time, `updateMany({ where: { tenantId, id, status: "QUEUED" }, data: { status: "RUNNING", startedAt, finishedAt: null, claimToken, attemptCount: +1 } })` (lines 183-197), skipping rows where `count !== 1`;
   - re-reads each claimed row by `id`, `status: "RUNNING"` and `claimToken`, and returns those (lines 199-210). They now say `RUNNING`. The earlier code returned the rows as read before the update, which still said `QUEUED` (test J3, run against that code).
5. For each job (`process-queued-integration-jobs.ts:24-50`): decide failure from `payloadJson.simulateFailure` (lines 25-29), call `completeJob` with the job's `claimToken` (lines 31-38), then `addLog` only if `completeJob` returned a row (lines 40-49).
6. `completeJob` sets `SUCCEEDED` or `FAILED`, `errorMessage` and `finishedAt`, but only where `status: "RUNNING"` and the `claimToken` match (`integration-repository.ts:213-233`). It returns `null` otherwise, and re-reads the job on success. The completion and its log are two statements, not one transaction.
7. Returns `200 { data: IntegrationJobRecord[] }` with the completed jobs.

The UI always sends `batchSize: 5` (`integration-operations-panel.tsx:51`).

## Failure codes by route

| Situation | Status | Where it comes from |
| --- | --- | --- |
| Unknown `x-demo-user-id` or empty string | 401 | `session.ts:22-24` |
| Non-platform user names another tenant | 403 | `session.ts:26-28` |
| No headers at all | not an error: acts as HR admin | `session.ts:17-19` |
| Role not allowed | 403 | `permissions.ts:19-22` |
| Self-review by a session with no `employeeId` | 403 | `permissions.ts:37-39` |
| Malformed or empty JSON body | **500** | `request.json()` SyntaxError -> `api-response.ts:32-40` |
| Body fails the Zod schema | **500** | ZodError -> `api-response.ts:32-40` |
| Duplicate `employeeNumber` in tenant | **500** | Prisma unique error (`schema.prisma:201`) -> `api-response.ts:32-40` |
| Manager or org unit not in tenant | 400 | `employee-service.ts:115-117,124-126` |
| Employee not in tenant | 404 | `employee-service.ts:51-53,91-93` |
| No SELF assignment for (cycle, user, employee) | 404 | `review-service.ts:56-58` |
| Cycle not ACTIVE | 409 | `review-service.ts:60-65` |
| Assignment already SUBMITTED | 409 | `review-service.ts:68-70` |
| Config not in tenant | 404 | `integration-service.ts:63-65` |
| Job not in tenant | 404 | `integration-service.ts:84-86` |
| Job not FAILED/RETRY_REQUIRED | 409 | `integration-service.ts:88-93` |
| Anything thrown by Prisma (DB down, etc.) | 500 | `api-response.ts:32-40` |

GET routes do not read a body, so they cannot hit the JSON/Zod rows.

## Lifecycle findings

### L1. Two sweeps claim the same jobs (fixed; the run below was against the earlier code)

- Current code: each claim is a conditional `updateMany` on `status: "QUEUED"` that also writes a fresh `claimToken` (`crypto.randomUUID()`) and increments `attemptCount` (`integration-repository.ts:182-197`). A row is kept only if `count === 1` and a re-read shows the same token (`:198-207`). `completeJob` requires `status: "RUNNING"` and the matching `claimToken` (`:217-231`), and the worker writes its completion log only when `completeJob` returned a row (`process-queued-integration-jobs.ts:40-49`). The schema gained `claimToken String?` and an index on `(tenantId, claimToken)` (`prisma/schema.prisma:368`, `:379`). The test `completes only the worker holding the immutable claim token` (`src/tests/workflow-atomicity.test.ts:223`) pins the completion side.
- Earlier evidence: the claim was "read QUEUED rows" then "update each by id", with no `status: "QUEUED"` in the update's `where`, no transaction or row lock, and no status condition on `completeJob`. The original file is kept at `astraupskill/snapshots/integration-repository.ts.original.txt`.
- What was run against that earlier code: two `processQueuedJobs` calls in parallel (`Promise.all`) over one QUEUED job. Both returned the job; two completion logs were written (test J1). Two parallel `claimQueuedJobs` calls over two jobs both returned `["j1", "j2"]` (test J2). The double is an in-memory store that yields to the event loop on every call, so the two calls interleave the same way two HTTP requests against PostgreSQL can. It is a model of the race, not a PostgreSQL run.
- How it happens in practice: an operator double-clicks "Process queued jobs" (the button disables only while `isPending`, `integration-operations-panel.tsx:49`, and React Query does not dedupe mutations), two tabs, or a future cron plus a manual click.
- Impact: a real vendor call would run twice. Here, logs duplicate, and if one run fails and the other succeeds, the final status is whichever `completeJob` lands last.
- What the fix chose: the per-row conditional update from the original fix sketch, plus a claim token, so that a worker that lost its claim cannot complete someone else's run. The alternative, one `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *`, would claim a batch in one round-trip. Remaining gap: the `findMany` and the per-row updates are separate statements, so two sweeps still read the same candidates. They just cannot both win a row.

### L2. A crash mid-sweep strands jobs in RUNNING (run)

- Evidence (still true): all jobs in the batch are marked RUNNING before any are processed (`integration-repository.ts:182-208`). If `completeJob` or `addLog` throws for job 1, the loop (`process-queued-integration-jobs.ts:24-50`) aborts and jobs 1..n stay RUNNING. Nothing ever looks at RUNNING again: the sweep selects QUEUED only (`integration-repository.ts:162`), retry accepts FAILED/RETRY_REQUIRED only (`integration-service.ts:88`), and `queueRetry`'s `where` repeats that rule (`integration-repository.ts:120`). The claim token does not help here, because no reaper ever releases a stale claim.
- What was run (against the earlier code, same shape): test J9 makes the first `completeJob` throw. Both jobs end in RUNNING, retry returns 409 "Current status: RUNNING", and a second sweep returns zero jobs.
- Fix sketch: per-job `try/catch` that marks the job FAILED on error; plus a reaper that moves RUNNING jobs with `startedAt` older than N minutes back to QUEUED or to RETRY_REQUIRED (which would finally give that enum value a writer).

### L3. Two retries of one job both succeed (fixed; the run below was against the earlier code)

- Current code: `queueRetry` runs one transaction. Its `updateMany` requires `status: { in: ["FAILED", "RETRY_REQUIRED"] }`, and it returns `null` unless `count === 1`. The retry log and the `INTEGRATION_JOB_RETRIED` audit row are written in the same transaction (`integration-repository.ts:115-153`). The losing request gets 404 "Integration job not found for retry." (`integration-service.ts:100-102`), which is a misleading code for a lost race. 409 would be accurate. `queueRetry` no longer increments `attemptCount`; the claim does (`integration-repository.ts:195`).
- Earlier evidence: `retryJob` read the job, checked status, then called a `queueRetry` whose `updateMany` had no status condition, and the service wrote the log and audit afterwards (snapshot: `astraupskill/snapshots/integration-service.ts.original.txt`).
- What was run against that earlier code: two parallel `retryJob` calls on one FAILED job both fulfilled; `attemptCount` went from 0 to 2; two `INTEGRATION_JOB_RETRIED` audit rows (test J8). Sequential double retries are correctly blocked: the second sees QUEUED and gets 409 (test J15).
- Remaining fix: map the `null` from `queueRetry` to 409 rather than 404.

### L4. Two self-review submissions both succeed (fixed; the run below was against the earlier code)

- Current code: the transaction's `updateMany` now repeats every identity and state rule in its `where`: tenant, id, cycle, reviewer, subject employee, `type: "SELF"`, `status: { in: ["NOT_STARTED", "IN_PROGRESS"] }`, and `reviewCycle: { status: "ACTIVE" }` (`review-repository.ts:106-121`). It returns `null` unless `count === 1` (`:123`), then `create`s the response (not `upsert`) and writes the `REVIEW_SUBMITTED` audit inside the same transaction (`:125-149`). Tests: `lets exactly one of two concurrent submissions claim the assignment` and `does not commit a self-review assignment when its audit insert fails` (`src/tests/workflow-atomicity.test.ts:184`, `:165`).
- Side effect worth knowing: the service turns every `null` into 404 "Review assignment was not found for submission." (`review-service.ts:84-86`). That covers a lost race, an `APPROVED` assignment (finding 6 in the README, now blocked at the write instead of in the service), and a cycle that left ACTIVE mid-request. All three are really 409s.
- Earlier evidence: the service checked `assignmentStatus === "SUBMITTED"` on a value read before the transaction, the transaction's `updateMany` had no status condition, and the response was an `upsert` (snapshot: `astraupskill/snapshots/review-repository.ts.original.txt`).
- What was run against that earlier code: two parallel calls with a repository that yields between read and write; both fulfilled and two `REVIEW_SUBMITTED` audit rows were created (test R5).
- Remaining fix: return a distinct result for "assignment changed" so the service can answer 409.

### L5. Retry is unbounded and resets evidence (run)

- `attemptCount` has no cap (test J7). It now counts claims, not retries (`integration-repository.ts:195`). `queueRetry` clears `errorMessage`, `startedAt`, `finishedAt` and `claimToken` (`integration-repository.ts:125-128`), so the last failure's message survives only in the job's logs, and `listJobs` shows only the newest 3 logs (`integration-repository.ts:48-52`). After a few retries the original error is invisible in the UI.
- Fix sketch: refuse retry above a limit (for example 5) with 409, and copy the previous `errorMessage` into the retry log's `detailsJson`.

## Debugging scenarios

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Every API call returns 500 "Unexpected server error." | DB unreachable or wrong DB name (`unison_hr` fallback vs `people_control_center` in compose) | `src/lib/db.ts:14-16`, server console |
| Creating an employee returns 500 | Validation failure (Zod) or duplicate `employeeNumber` | server console shows the real error; `api-response.ts:32` |
| Integrations page shows "The HR_ADMIN role cannot view integration configs." | Default session is HR admin | switch to the integration admin in the shell |
| Self-review returns 404 "Self-review assignment not found." | Acting user has no SELF assignment in that cycle (HR admin, manager) | `prisma/seed.ts:294-327` |
| Self-review returns 409 "only allowed while the cycle is ACTIVE" | The panel's cycle dropdown allows the DRAFT cycle | `review-cycle-panel.tsx` select; seed `cycle_2026_calibration_prep` |
| Reviews card says AVAILABLE after submitting | Hook invents the value | `src/hooks/useReviewCycles.ts:39-40` |
| A retried job fails again immediately | Seeded payload has `simulateFailure: true`; retry does not change payload | `prisma/seed.ts:397`, `process-queued-integration-jobs.ts:25-29` |
| A job stays RUNNING forever and Retry is disabled | Sweep aborted mid-batch (L2) | `integration-repository.ts:182-208` |
| A job has two "Job completed during worker processing." logs | Should no longer happen (L1 fix). If it does, a writer bypassed the claim token | `integration-repository.ts:182-231` |
| Retry returns 404 "Integration job not found for retry." for a job that exists | Lost a race with another retry, or the job left FAILED/RETRY_REQUIRED between the read and the write (L3) | `integration-repository.ts:116-131`, `integration-service.ts:100-102` |
| Self-review returns 404 "Review assignment was not found for submission." | Assignment already `APPROVED`, a concurrent submit won, or the cycle left ACTIVE (L4) | `review-repository.ts:106-123` |
| An older job is missing from the list | `listJobs` returns only 20 | `integration-repository.ts:55` |
