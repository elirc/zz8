# Concepts Demonstrated

## Service Layer
Where to look: `src/services/employee-service.ts` — `EmployeeService.createEmployee()` owns the permission check, cross-entity validation, write, and audit log.
Also see: `src/services/review-service.ts` for workflow/state-transition rules instead of CRUD-only logic.
Risk if wrong: Business rules drift into routes or components and become inconsistent across endpoints.

## Repository Pattern
Where to look: `src/repositories/employee-repository.ts` — `list()`, `findById()`, and `update()` isolate Prisma access behind tenant-aware methods.
Also see: `src/repositories/integration-repository.ts` for async/operational persistence methods like `queueRetry()` and `claimQueuedJobs()`.
Risk if wrong: Services become tightly coupled to incidental ORM payload shapes and tenant filters become easy to miss.

## Zod Validation Boundary
Where to look: `src/app/api/employees/route.ts` — `createEmployeeSchema.parse(await request.json())` rejects malformed input before business logic runs.
Also see: `src/lib/validation/reviewSchemas.ts` and `src/lib/validation/integrationSchemas.ts`.
Risk if wrong: Bad input leaks into services and fails later in harder-to-debug ways.

## Auth / Session Flow
Where to look: `src/lib/auth/session.ts` — `resolveSession()` and `requireSession()` build the authenticated session from demo headers.
Also see: `src/components/providers/demo-session-provider.tsx` for how the browser chooses the active demo actor.
Risk if wrong: The wrong user or wrong tenant can reach protected code paths.

## Role-Based Access Control
Where to look: `src/lib/auth/permissions.ts` — `assertTenantRole()` and `assertPlatformRole()` enforce explicit access rules.
Also see: `src/services/integration-service.ts` in `assertIntegrationAccess()` for a domain-specific composition of those guards.
Risk if wrong: The API may allow ordinary employees to mutate HR or ops records.

## State / Status Transitions
Where to look: `src/services/review-service.ts` — `submitSelfReview()` checks `cycleStatus` and `assignmentStatus` before allowing submission.
Also see: `src/tests/review-transition.test.ts` for the invalid-transition guard.
Risk if wrong: Review submissions can be duplicated or accepted from illegal states.

## Audit Logging
Where to look: `src/repositories/audit-log-repository.ts` — `create()` writes tenant-owned audit records.
Also see: `src/services/employee-service.ts`, `src/services/review-service.ts`, and `src/services/integration-service.ts` for where audit entries are triggered.
Risk if wrong: Sensitive writes become hard to investigate and compliance stories get weak.

## Background Job Design
Where to look: `src/jobs/process-queued-integration-jobs.ts` — `processQueuedIntegrationJobs()` loops over claimed jobs and writes terminal states and logs.
Also see: `src/app/api/integration-jobs/process/route.ts` for the thin trigger route.
Risk if wrong: Async work leaves jobs stuck in intermediate states or processes the wrong tenant's queue.

## Multi-Tenancy
Where to look: `src/repositories/repository-context.ts` — `toRepositoryContext()` injects `tenantId` into every repository call.
Also see: `src/repositories/employee-repository.ts`, `src/repositories/review-repository.ts`, and `src/repositories/integration-repository.ts` for the actual tenant-scoped Prisma queries.
Risk if wrong: Cross-tenant reads and writes become possible with a single missing filter.
