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

Request: Submit a self review
1. `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` — `POST()` parses the route param and validates the body with `submitSelfReviewSchema`.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` loads the authenticated session.
3. `src/lib/validation/reviewSchemas.ts` — `submitSelfReviewSchema.parse()` enforces the input boundary.
4. `src/services/reviewCycleService.ts` — `reviewCycleService` compatibility export resolves the concrete review service instance.
5. `src/services/review-service.ts` — `ReviewService.submitSelfReview()` enforces role checks and workflow-state checks.
6. `src/repositories/repository-context.ts` — `toRepositoryContext()` supplies the tenant-aware repository scope.
7. `src/repositories/review-repository.ts` — `findSelfReviewContext()` verifies assignment ownership, then `submitSelfReview()` updates the assignment and response in a transaction.
8. `src/repositories/audit-log-repository.ts` — `create()` records `REVIEW_SUBMITTED`.
9. Returns `200` with `{ data: { assignmentId, cycleName, submittedAt } }`.

Request: Retry a failed integration job
1. `src/app/api/integration-jobs/[jobId]/retry/route.ts` — `POST()` parses the job id and validates the retry reason.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the acting session.
3. `src/lib/validation/integrationSchemas.ts` — `retryIntegrationJobSchema.parse()` validates the operator input.
4. `src/services/integrationService.ts` — `integrationService` compatibility export resolves the concrete service instance.
5. `src/services/integration-service.ts` — `IntegrationService.retryJob()` checks tenant/platform access and the current job status.
6. `src/repositories/repository-context.ts` — `toRepositoryContext()` supplies tenant scope.
7. `src/repositories/integration-repository.ts` — `findJobById()`, `queueRetry()`, and `addLog()` perform the tenant-scoped write path.
8. `src/repositories/audit-log-repository.ts` — `create()` records `INTEGRATION_JOB_RETRIED`.
9. Returns `200` with `{ data: IntegrationJobRecord }`.

Request: Reject an employee user trying to create another employee
1. `src/app/api/employees/route.ts` — `POST()` validates the body and forwards to the employee service.
2. `src/lib/http/route-context.ts` — `buildRouteContext()` resolves the session.
3. `src/lib/auth/session.ts` — `requireSession()` loads the `EMPLOYEE` actor from the demo headers.
4. `src/services/employeeService.ts` — `employeeService` compatibility export resolves the concrete service instance.
5. `src/services/employee-service.ts` — `EmployeeService.createEmployee()` calls `assertTenantRole()`.
6. `src/lib/auth/permissions.ts` — `assertTenantRole()` throws `AppError(403, ...)`.
7. `src/lib/http/api-response.ts` — `handleRouteError()` converts the `AppError` into JSON.
8. Returns `403` with `{ error: { message } }`.
