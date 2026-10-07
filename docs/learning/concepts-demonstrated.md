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

---

## How well each concept is demonstrated (2026-10 docs pass)

The entries above point at the right files. This section adds where each example is solid and where it stops short, so a learner does not copy the gaps along with the pattern. Labels: (run) executed in the scratch harness, (by reading) from the code only.

| Concept | Solid part | Where it stops short | Evidence |
| --- | --- | --- | --- |
| Service layer | All 11 public service methods start with a guard; routes contain no rules. | Two "services" per domain (class plus singleton wrapper) confuse readers; see docs/architecture/README.md. | `employee-service.ts:29-105`; matrix test G1 (run) |
| Repository pattern | Prisma never appears outside `src/repositories/` and `src/lib/db.ts`. | `mapEmployee` is an identity function (`employee-repository.ts:12-28`), so the "DTO" is the raw Prisma shape, including compensation. A dead second contract file exists (`src/lib/repositories/contracts.ts`). | by reading |
| Zod validation boundary | Schemas are strict on lengths and enums; the update schema is a `pick().partial()` with a non-empty refine (`employeeSchemas.ts:27-38`). | Failures become 500, not 400 (finding A2). | `api-response.ts:19-40` (run with stand-in) |
| Auth / session flow | Centralized in one function; tenant mismatch rejected for normal users. | Missing headers default to HR admin (A1); roles never come from the DB (A4). | `session.ts:17-28` (run) |
| RBAC | Guards are small and readable. | `assertPlatformRole` call is a no-op (A5); `PLATFORM_SUPPORT` treated two ways; managers see all compensation (A6). | `integration-service.ts:108-119`; test G2 (run) |
| State transitions | Cycle must be ACTIVE; SUBMITTED blocked; retry only from FAILED/RETRY_REQUIRED; the writes now repeat those conditions (`review-repository.ts:106-121`, `integration-repository.ts:116-121`). | A lost race or an `APPROVED` assignment surfaces as 404, not 409; `RETRY_REQUIRED` and `CANCELLED` have no writer. | `workflow-atomicity.test.ts:184`; J8, R1 and R5 ran on the earlier code |
| Audit logging | Tenant and actor taken from context, never from the body (`audit-log-repository.ts:24-25`); review submit and job retry now write their audit inside the business transaction. | Not written for queue or process; `INTEGRATION_JOB_PROCESSED` never used; employee create/update still audit outside any transaction; update audit records field names only. | test J12 (run); `employee-service.ts:100`; `workflow-atomicity.test.ts:165` |
| Background job design | Processing loop is a plain function with injected deps (`process-queued-integration-jobs.ts:10-16`), easy to test; claims are conditional and token-checked (L1 fix). | No per-job error handling or stale-claim reaper (L2), no scheduler despite `scheduleCron`. | test J9 (run); `workflow-atomicity.test.ts:223` |
| Multi-tenancy | Every one of the 25 Prisma calls is tenant-filtered. | The tenant id comes from a header; FKs are not tenant-composite; the only isolation test tests its own fake. | `testing-rationale.md` |

## Concepts the code exposes but the list above does not name

### Check-then-act races
Where to look: `src/services/integration-service.ts:82-98` (status read, then `queueRetry`), `src/repositories/integration-repository.ts:158-211` (read QUEUED, then claim), `src/services/review-service.ts:50-82` (read assignment status, then write).
What to learn: a status check in the service is only safe if the write repeats it (`where: { id, status: ... }` and check the affected count) or runs under a lock. All three sites used to skip that; tests J1, J8 and R5 (run against that code) showed two parallel callers both passing the check. All three now repeat it in the write: `integration-repository.ts:120`, `:188`, and `review-repository.ts:114`. Compare the snapshots in `astraupskill/snapshots/` with the current files to see the whole pattern.
Risk if wrong: duplicated vendor calls, double-counted attempts, overwritten review answers.

### Error mapping at the HTTP edge
Where to look: `src/lib/http/app-error.ts:7-21` and `src/lib/http/api-response.ts:19-40`.
What to learn: a typed application error carrying a status is a clean pattern. It only works if every expected failure is converted into it. Library errors (Zod, JSON, Prisma unique) must be mapped explicitly or they become 500.
Risk if wrong: clients cannot distinguish bad input from outages; logs fill with noise.

### Composition root
Where to look: `src/services/service-factory.ts:15-39`.
What to learn: one place builds the object graph; services take dependencies through their constructor (`EmployeeServiceDeps`, `ReviewServiceDeps`, `IntegrationServiceDeps`), typed with `Pick<>` so a test double only needs the methods actually used. `src/tests/review-transition.test.ts:23-41` uses exactly that.
Risk if wrong: routes construct their own dependencies and behavior drifts per endpoint.

### Cache keys that include identity
Where to look: every React Query key includes `activeSessionId` (`src/hooks/useEmployees.ts:22`, `useReviewCycles.ts:18`, `useIntegrationOps.ts:63,75`).
What to learn: when the same URL returns different data per user, the user must be part of the cache key, or switching roles shows the previous role's data for up to the 30-second `staleTime` (`app-providers.tsx:21`).
Risk if wrong: cross-role data shown in the UI.

### Client-side mirrors of server rules
Where to look: the Retry button is disabled unless the job is FAILED/RETRY_REQUIRED (`integration-operations-panel.tsx:258-261`), matching `integration-service.ts:88`; the employee form uses the server's own schema through `zodResolver` (`employee-directory.tsx:23-24`).
What to learn: mirroring rules in the UI is good UX, but the server must still enforce them, and the two copies drift. The review panel shows the drift: it claims the API returns per-actor status (`review-cycle-panel.tsx:37`) when it does not.
Risk if wrong: the UI promises something the server does not do.

## Exercises

1. Point to the single line that would have to change so a missing header is rejected. Answer: `src/lib/auth/session.ts:17` (and line 19 for the tenant).
2. Which concept above has a test in `src/tests/` that would fail if the concept were broken in the real code? Answer: role-based access (`auth-permissions.test.ts`) and state transitions (`review-transition.test.ts`). The tenant-isolation test would not fail (it tests its own class).
3. Rewrite `queueRetry`'s `where` so the retry race disappears. Answer: `{ tenantId: ctx.tenantId, id: input.jobId, status: { in: ["FAILED", "RETRY_REQUIRED"] } }`, then return `null` when `count === 0` and let the service map that to 409.
