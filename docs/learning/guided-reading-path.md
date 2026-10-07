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

---

## Verification notes on the steps above (2026-10 docs pass)

- Step 1: "Every protected request starts here." True: every route calls `buildRouteContext()` first. **Addition:** what a junior would also miss is the fallback on lines 17-19. With no headers, the caller becomes an HR admin.
- Step 3: "Called by all three service classes; consumed by all repository classes." True (`employee-service.ts:16`, `review-service.ts:13`, `integration-service.ts:17`; every repository method takes `ctx`).
- Step 5: "Called by `src/services/employeeService.ts`, ..." True; each wrapper is one line (`employeeService.ts:3` etc.).
- Step 7: "`updateMany()` is used here to keep tenant scoping explicit on writes." True (`employee-repository.ts:147-153`). Side effect: `updateMany` returns only a count, so the repository has to re-read the row with `findById` (line 159).
- Step 10: "The response upsert and assignment status update belong in one transaction." True, and they are (`review-repository.ts:105`). The response is now a `create`, and the transaction also re-checks the status and writes the audit row, which stops a concurrent double submit (finding L4, fixed).
- Step 12: "Queue workers still need tenant-scoped filters on claims and completions." True and present. The more important miss used to be that the claim was not atomic (finding L1). It is now a conditional, token-carrying update (`integration-repository.ts:182-207`).
- Step 13: "Background processing should still emit logs and terminal states consistently." The happy path does; an exception mid-loop does not (finding L2, run).

## Check yourself (with answers)

Each question is answerable from the file named in the step. Answers cite the line.

| Step | Question | Answer |
| --- | --- | --- |
| 1 | What does `GET /api/employees` return with no headers? | 200 and the full northstar directory: the request is treated as `user_hr_admin` (`session.ts:17-19`, `demo-sessions.ts:13-20`). |
| 1 | Which status does an empty `x-demo-user-id: ""` produce? | 401. `??` keeps empty strings, and `demoSessions[""]` is undefined (`session.ts:17,22-24`). |
| 2 | Can `assertPlatformRole` ever throw in the current code? | No. Its only caller already checked the role is in the allowed list (`integration-service.ts:108,115-119`). |
| 2 | Does `PLATFORM_SUPPORT` bypass `assertTenantRole`? | No, only `PLATFORM_ADMIN` does (`permissions.ts:16`). |
| 3 | Which session field becomes `actorUserId`? | `session.userId` (`repository-context.ts:17`). |
| 4 | Which two unique constraints does `ReviewResponse` have? | `reviewAssignmentId @unique` (line 271) and `@@unique([tenantId, reviewAssignmentId])` (line 282). |
| 4 | What stops a manager from another tenant being stored in `Employee.managerId`? | Nothing in the schema (line 191). Only the service check in `employee-service.ts:112-118`. |
| 5 | How many `AuditLogRepository` instances exist at runtime? | One, shared by all three services (`service-factory.ts:15`). |
| 6 | Can an employee be their own manager? | Yes. `assertTenantReferences` only checks the manager exists in the tenant (`employee-service.ts:112-118`). Test G3, run. |
| 6 | What does the update audit row record? | Only the names of the changed fields (`employee-service.ts:100`), not old or new values. |
| 7 | Which fields does `list()` return for each employee? | Every scalar column, including `compensationCents`, plus the selected `manager` and `orgUnit` fields (`employee-repository.ts:46-53`; `include` keeps all scalars). |
| 8 | Is the `search` parameter used? | No. `GET()` calls `listEmployees(session)` with no search (`route.ts:15`). |
| 9 | Which assignment statuses can submit? | The service lets anything except `SUBMITTED` through (`review-service.ts:68`). The repository write accepts only `NOT_STARTED` and `IN_PROGRESS` (`review-repository.ts:114`), so `APPROVED` ends as a 404 from `review-service.ts:84-86`. |
| 9 | Is the cycle's `endDate` checked? | No; only `cycleStatus === "ACTIVE"` (`review-service.ts:60`). |
| 10 | How is the response written now, and what stops a duplicate? | `tx.reviewResponse.create` (`review-repository.ts:125-135`), after the conditional `updateMany` (`:106-123`). A second response would also violate `reviewAssignmentId @unique` (`schema.prisma:271`). The earlier code used an `upsert` on `tenantId_reviewAssignmentId`. |
| 11 | Which job statuses can be retried? | `FAILED` and `RETRY_REQUIRED` (`integration-service.ts:88`). |
| 11 | Is there a retry limit? | No (test J7, run). |
| 11 | Does queueing check `config.isActive`? | No (`integration-service.ts:58-71`; test J10, run). |
| 12 | What status do the rows returned by `claimQueuedJobs` carry? | The pre-update value, `QUEUED` (line 170 returns the `findMany` result; test J3, run). |
| 12 | Which write increments `attemptCount`? | Only `queueRetry` (lines 125-127). |
| 13 | How is a failure decided? | `payloadJson.simulateFailure` truthy (lines 25-29). |
| 14 | What does the provider return on the server for the active session? | `"user_hr_admin"` (`demo-session-provider.tsx:39-41`). |
| 15 | What batch size does the UI send? | 5 (`integration-operations-panel.tsx:51`). |

## Optional extra steps

### Step 16 — src/lib/http/api-response.ts
**Why read this:** Every error the API returns passes through `handleRouteError()`.
**What to look for:** the single `isAppError` branch (line 20) and the 500 fallback (lines 32-40).
**What to trace:** Called by all eight route files.
**What a junior would likely miss:** `ZodError` and the JSON `SyntaxError` are not `AppError`, so bad input becomes 500 (finding A2).

### Step 17 — src/lib/demo/demo-sessions.ts
**Why read this:** It is the real role table of the app.
**What to look for:** `DEFAULT_DEMO_SESSION` (lines 13-20) and the platform admin without `employeeId` (lines 23-29).
**What to trace:** Used by `session.ts`, `client.ts`, and the provider.
**What a junior would likely miss:** editing `TenantMembership` rows in the database changes nothing; this object decides.

### Step 18 — src/hooks/useReviewCycles.ts
**Why read this:** It shows a client inventing data the API does not return.
**What to look for:** lines 37-42.
**What to trace:** Feeds `review-cycle-panel.tsx:66`.
**What a junior would likely miss:** the "AVAILABLE" label is not from the server.

### Step 19 — src/lib/repositories/contracts.ts (read last, as a cautionary file)
**Why read this:** To recognize leftover code.
**What to look for:** method names that do not exist in `src/repositories/` (`listQueuedJobs`, `markRunning`, `markProcessed`).
**What to trace:** Nothing imports it.
**What a junior would likely miss:** a well-commented file can still be dead. Search for imports before trusting it.
