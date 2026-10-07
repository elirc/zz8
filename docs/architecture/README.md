# Architecture

Unison HR combines three product areas in one tenant-aware Next.js application: HRIS core data, performance review workflows, and integration operations. The app layer lives in `src/app/`, the business layer lives in `src/services/`, the database access layer lives in `src/repositories/`, and shared cross-cutting infrastructure lives in `src/lib/`.

Top-level folders and how they relate:

- `prisma/`
  - `prisma/schema.prisma` defines the tenant-owned relational model.
  - `prisma/seed.ts` seeds demo tenants, users, employees, cycles, and jobs that match the demo session headers.
- `src/app/`
  - `src/app/api/employees/route.ts` and `src/app/api/review-cycles/route.ts` are thin HTTP entrypoints.
  - `src/app/employees/page.tsx`, `src/app/reviews/page.tsx`, and `src/app/integrations/page.tsx` compose UI pages from feature panels.
- `src/services/`
  - `src/services/employee-service.ts`, `src/services/review-service.ts`, and `src/services/integration-service.ts` own business rules.
  - `src/services/service-factory.ts` wires Prisma-backed repositories into concrete service instances.
- `src/repositories/`
  - `src/repositories/employee-repository.ts`, `src/repositories/review-repository.ts`, and `src/repositories/integration-repository.ts` issue tenant-scoped Prisma queries.
  - `src/repositories/repository-context.ts` carries `tenantId` and `actorUserId` from the session into repository calls.
- `src/lib/`
  - `src/lib/auth/session.ts` resolves the acting session from demo headers.
  - `src/lib/auth/permissions.ts` centralizes tenant and platform role checks.
  - `src/lib/validation/*.ts` define Zod request boundaries.
  - `src/lib/db.ts` creates the Prisma client with the PostgreSQL adapter.
- `src/components/` and `src/hooks/`
  - `src/components/employees/employee-directory.tsx` stays UI-focused and delegates network state to `src/hooks/useEmployees.ts`.
  - `src/components/providers/demo-session-provider.tsx` keeps the demo role-switching state outside feature panels.
- `src/jobs/`
  - `src/jobs/processIntegrationJobs.ts` and `src/jobs/process-queued-integration-jobs.ts` isolate worker-style queue processing from the route handlers.

This project intentionally keeps validation, authorization, workflow rules, and persistence in separate files so a reviewer can trace a request from page to route to service to repository without business logic disappearing into React components.

---

## Verification notes (2026-10 docs pass)

Every statement above was checked against the code. All of it holds, with two clarifications:

- "seeds ... jobs that match the demo session headers": true for the five `tenant_northstar` users (`prisma/seed.ts:49-76` vs `src/lib/demo/demo-sessions.ts:22-55`). The seed also creates `user_atlas_hr` in `tenant_atlas` (`prisma/seed.ts:79`), which has no demo session.
- "The app layer ... `src/app/api/employees/route.ts` and `src/app/api/review-cycles/route.ts`": these are two of **eight** route files. The full list is in the route inventory below.

Labels used in this doc set: **(run)** means the behavior was executed in a scratch harness with `node --test` (see [testing-rationale.md](../learning/testing-rationale.md#checks-that-were-run-for-these-docs)). **(by reading)** means it was established by reading the code only.

## The layers, file by file

| Layer | Files | Lines | Role |
| --- | --- | --- | --- |
| Pages | `src/app/page.tsx`, `src/app/employees/page.tsx`, `src/app/reviews/page.tsx`, `src/app/integrations/page.tsx`, `src/app/layout.tsx` | 82, 10, 10, 10, 36 | Server components that wrap a client panel in `AppShell`. |
| Panels | `src/components/employees/employee-directory.tsx`, `src/components/reviews/review-cycle-panel.tsx`, `src/components/integrations/integration-operations-panel.tsx`, `src/components/shell/app-shell.tsx` | 208, 163, 286, 114 | Client UI; call hooks only. |
| Providers | `src/components/providers/app-providers.tsx`, `src/components/providers/demo-session-provider.tsx` | 33, 87 | React Query client (30 s `staleTime`, `app-providers.tsx:16-25`) and the demo-session context. |
| Hooks | `src/hooks/useEmployees.ts`, `src/hooks/useReviewCycles.ts`, `src/hooks/useIntegrationOps.ts` | 89, 74, 126 | React Query queries and mutations; every call goes through `apiFetch`. |
| HTTP client | `src/lib/http/client.ts` | 68 | `apiFetch()` adds demo headers and unwraps `{ data }`. |
| Routes | 8 files under `src/app/api/` | 19-39 each | Build session, parse body with Zod, call one service method, map errors. |
| Route plumbing | `src/lib/http/route-context.ts`, `src/lib/http/api-response.ts`, `src/lib/http/app-error.ts` | 13, 41, 21 | Session -> context; `ok`/`created`/`handleRouteError`; the `AppError` type. |
| Auth | `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/demo/demo-sessions.ts` | 44, 40, 63 | Header -> session; role assertions; the hard-coded user directory. |
| Validation | `src/lib/validation/employeeSchemas.ts`, `reviewSchemas.ts`, `integrationSchemas.ts` | 41, 17, 24 | Zod 4 schemas. |
| Service wrappers | `src/services/employeeService.ts`, `reviewCycleService.ts`, `integrationService.ts` | 3 each | Module-level singletons that the routes import. |
| Services | `src/services/employee-service.ts`, `review-service.ts`, `integration-service.ts`, `service-factory.ts` | 129, 101, 156, 39 | Business rules and permission checks. |
| Jobs | `src/jobs/processIntegrationJobs.ts`, `src/jobs/process-queued-integration-jobs.ts` | 15, 53 | Sweep entrypoint and the processing loop. |
| Repositories | `src/repositories/*.ts` (6 files) | 19-211 | Tenant-scoped Prisma access. |
| Shared types | `src/lib/domain.ts`, `src/repositories/repository-types.ts` | 84, 92 | Enum tuples, `AppSession`, repository return shapes. |
| Dead code | `src/lib/repositories/contracts.ts` | 151 | Not imported anywhere (see below). |
| DB | `src/lib/db.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma.config.ts` | 28, 409, 449, 10 | Prisma client singleton, schema, seed, CLI config. |
| Tests | `src/tests/*.test.ts` (4 files) | 29-56 | Vitest; see testing-rationale.md. |

## Which duplicate-looking files are live?

The tree has pairs of files with the same name in two spellings. They are **not** duplicates of each other. They are two layers of one runtime path (by reading; every import below was checked with a repo-wide search).

| Kebab-case file | camelCase file | What each contains | Who imports which |
| --- | --- | --- | --- |
| `src/services/employee-service.ts` | `src/services/employeeService.ts` | Kebab: the `EmployeeService` class (`employee-service.ts:26-129`). Camel: `export const employeeService = createEmployeeService();` (`employeeService.ts:3`). | Both employee routes import the camel singleton (`src/app/api/employees/route.ts:10`, `[employeeId]/route.ts:10`). The class is imported only by `service-factory.ts:11`. |
| `src/services/integration-service.ts` | `src/services/integrationService.ts` | Kebab: `IntegrationService` class and the `IntegrationServiceDeps` type (`integration-service.ts:19-138`). Camel: `export const integrationService = createIntegrationService();` (`integrationService.ts:3`). | Three integration routes import the camel singleton (`integration-configs/route.ts:9`, `integration-jobs/route.ts:10`, `[jobId]/retry/route.ts:10`). The process route goes through `src/jobs/processIntegrationJobs.ts:8`, which also imports the camel singleton. The kebab file is imported by `service-factory.ts:12` and, as a type only, by `src/jobs/process-queued-integration-jobs.ts:7`. |
| `src/services/review-service.ts` | `src/services/reviewCycleService.ts` | Kebab: `ReviewService` class. Camel: `export const reviewCycleService = createReviewService();` (`reviewCycleService.ts:3`). | Both review routes import the camel singleton (`review-cycles/route.ts:9`, `submit-self-review/route.ts:10`). The class is imported by `service-factory.ts:13` and directly by `src/tests/review-transition.test.ts:9`. |
| `src/jobs/process-queued-integration-jobs.ts` | `src/jobs/processIntegrationJobs.ts` | Kebab: the processing loop `processQueuedIntegrationJobs()`. Camel: `runIntegrationJobSweep()`, a one-line pass-through to `integrationService.processQueuedJobs()` (`processIntegrationJobs.ts:10-15`). | Route -> camel -> service -> kebab. Both live. |

So the answer to "which is live" is **both, stacked**: route -> camelCase singleton -> `service-factory.ts` -> kebab-case class. `docs/learning/build-journal.md` (Stage 4 and "Decision: Use compatibility wrappers") explains that the camelCase wrappers were added during recovery from an interrupted build instead of a rename.

The runtime object graph (from `src/services/service-factory.ts:15-39`):

```
module load of service-factory.ts
  auditLogRepository    = new AuditLogRepository()      (line 15)
  employeeRepository    = new EmployeeRepository()      (line 16)
  reviewRepository      = new ReviewRepository()        (line 17)
  integrationRepository = new IntegrationRepository()   (line 18)

employeeService.ts      -> createEmployeeService()    -> new EmployeeService({employeeRepository, auditLogRepository})
reviewCycleService.ts   -> createReviewService()      -> new ReviewService({reviewRepository, auditLogRepository})
integrationService.ts   -> createIntegrationService() -> new IntegrationService({integrationRepository, auditLogRepository})
```

All three services share one `AuditLogRepository` instance. The repositories hold no state of their own; they all call the shared `db` from `src/lib/db.ts:19-24`.

### The one real leftover: `src/lib/repositories/contracts.ts`

This file is **dead code** (by reading: no file imports `@/lib/repositories/contracts` or any path under `src/lib/repositories`). It declares a second, different set of repository interfaces and DTOs:

| `contracts.ts` declares | What the live code actually uses |
| --- | --- |
| `EmployeeRepository.listByTenant(tenantId)` (line 81) | `EmployeeRepository.list(ctx, search?)` in `src/repositories/employee-repository.ts:31` |
| `ReviewCycleRepository.findSelfAssignment(...)` (lines 117-122) | `ReviewRepository.findSelfReviewContext(ctx, {...})` in `src/repositories/review-repository.ts:49` |
| `IntegrationRepository.listQueuedJobs`, `markRunning`, `markProcessed` (lines 140-146) | `claimQueuedJobs`, `completeJob` in `src/repositories/integration-repository.ts:158,213` |
| `AuditLogInput.metadata` with `tenantId` in the input (lines 71-78) | `CreateAuditLogInput.metadataJson`, tenant taken from `ctx` (`src/repositories/audit-log-repository.ts:13-18`) |
| `ReviewCycleRecord.selfAssignmentStatus` (line 40) | Not returned by the API at all; the hook invents it (`src/hooks/useReviewCycles.ts:39-40`) |

It also defines a second `EmployeeRecord` (lines 16-32, flat `managerName`/`orgUnitName`) that conflicts with the live `EmployeeRecord` in `src/repositories/repository-types.ts:16-30` (nested `manager`/`orgUnit`). A reader who opens `contracts.ts` first will learn the wrong API. Safe fix: delete it, or move it to an `archive/` note. (Not done here; this pass edits Markdown only.)

## Route inventory

| Route file | Methods | Body schema | Service entry |
| --- | --- | --- | --- |
| `src/app/api/employees/route.ts` | GET, POST | `createEmployeeSchema` (POST) | `employeeService.listEmployees` / `createEmployee` |
| `src/app/api/employees/[employeeId]/route.ts` | GET, PATCH | `updateEmployeeSchema` (PATCH) | `employeeService.getEmployee` / `updateEmployee` |
| `src/app/api/review-cycles/route.ts` | GET | none | `reviewCycleService.listCycles` |
| `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` | POST | `submitSelfReviewSchema` | `reviewCycleService.submitSelfReview` |
| `src/app/api/integration-configs/route.ts` | GET | none | `integrationService.listConfigs` |
| `src/app/api/integration-jobs/route.ts` | GET, POST | `queueIntegrationJobSchema` (POST) | `integrationService.listJobs` / `queueJob` |
| `src/app/api/integration-jobs/[jobId]/retry/route.ts` | POST | `retryIntegrationJobSchema` | `integrationService.retryJob` |
| `src/app/api/integration-jobs/process/route.ts` | POST | `processQueuedJobsSchema` | `runIntegrationJobSweep` |

Every handler has the same shape: `try { buildRouteContext(request); [await params]; schema.parse(await request.json()); service call; ok()/created() } catch { handleRouteError() }`. The session is always built **before** the body is parsed. That ordering matters for which error you see first (see request-lifecycle.md).

There is no `DELETE` anywhere, no route to create or change review cycles, assignments, goals, feedback requests, calibration sessions, configs or mapping rules. Those tables are seed-only (see domain-model.md).

## Configuration facts

| Fact | Evidence |
| --- | --- |
| Prisma 7 with the `pg` driver adapter | `src/lib/db.ts:7-8,17-24`; `package.json` deps `@prisma/adapter-pg ^7.7.0`, `@prisma/client ^7.7.0` |
| Datasource URL comes from `prisma.config.ts`, not the schema | `prisma/schema.prisma:11-13` has no `url`; `prisma.config.ts:7-9` sets `url: env("DATABASE_URL")` |
| Fallback DB name differs from docker-compose | `src/lib/db.ts:16` (`unison_hr`) vs `docker-compose.yml:7` (`people_control_center`) |
| Prisma client is cached on `globalThis` outside production | `src/lib/db.ts:10-12,26-28` |
| Dev logging is `error`+`warn`, otherwise `error` only | `src/lib/db.ts:23` |
| `next.config.ts` is the empty default | `next.config.ts:3-5` |
| Vitest runs only `src/tests/**/*.test.ts` in a node environment | `vitest.config.ts:6-8` |
| The `@` alias maps to `src` for both Vitest and TypeScript | `vitest.config.ts:10-12,17-20` |

## Cross-cutting design choices, and where they are thinner than they look

| Choice | Where | Holds? |
| --- | --- | --- |
| Permission checks live in services, not routes | every service method starts with an `assert*` call | Yes. All 11 service entry points call a guard first (run, see the matrix in auth-and-permissions.md). |
| Tenant scope lives in repositories | every Prisma `where` includes `tenantId: ctx.tenantId` | Yes for all 25 Prisma calls in the four repository files (by reading; 21 before the atomicity change added the claim re-read and three in-transaction writes, all of which also carry `tenantId`). But the tenant itself comes from a request header (auth doc, finding A3). |
| Writes use tenant-scoped `updateMany` | `employee-repository.ts:147`, `integration-repository.ts:116,184,217`, `review-repository.ts:106` | Yes. The integration and review writes now also carry a **status** condition (and, for jobs, a claim token), which closed the race findings L1, L3 and L4 in request-lifecycle.md. The employee update still does not, so concurrent edits are last-write-wins. |
| Errors are mapped centrally | `src/lib/http/api-response.ts:19-40` | Only `AppError` is mapped. Zod and JSON errors fall to 500 (run). |
| Audit log on sensitive writes | `employee-service.ts:66,95` (via `AuditLogRepository`), `review-repository.ts:137`, `integration-repository.ts:141` (inside their transactions) | Four of six write paths. `ReviewService` and `IntegrationService` still declare an `auditLogRepository` dependency (`review-service.ts:20`, `integration-service.ts:32`) that they no longer call. `queueJob` and the processing sweep write no audit rows, and `INTEGRATION_JOB_PROCESSED` (`src/lib/domain.ts:73`) is never emitted (run). |
| Background processing isolated in `src/jobs/` | `src/jobs/*.ts` | Yes, but it is triggered only by an HTTP call from the UI. There is no scheduler, even though configs carry a `scheduleCron` (`prisma/schema.prisma:330`). |

## Where to read next

- [auth-and-permissions.md](auth-and-permissions.md) for the session adapter, the full gate matrix, and findings A1-A8.
- [request-lifecycle.md](request-lifecycle.md) for every route, step by step, including the failure codes.
- [domain-model.md](domain-model.md) for the schema and which status values can actually be reached.
