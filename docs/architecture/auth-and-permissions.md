# Auth And Permissions

This codebase uses a demo-session adapter instead of a production identity provider, but the authorization boundaries are still explicit and centralized.

Session flow:

- Request identity is resolved in `src/lib/auth/session.ts` by `resolveSession()` and `requireSession()`.
- API routes call `buildRouteContext()` in `src/lib/http/route-context.ts`, which is the only place the route layer turns an HTTP request into an authenticated session.
- The browser sends the demo actor through `src/lib/http/client.ts`, which reads `DEMO_SESSION_STORAGE_KEY` from `src/lib/demo/demo-sessions.ts`.
- UI role switching lives in `src/components/providers/demo-session-provider.tsx`, so feature panels do not own auth-like state.

Role enforcement:

- Tenant role checks are centralized in `src/lib/auth/permissions.ts` inside `assertTenantRole()`.
- Platform role checks are centralized in `src/lib/auth/permissions.ts` inside `assertPlatformRole()`.
- Employee-linked workflow checks are centralized in `src/lib/auth/permissions.ts` inside `assertEmployeeContext()`.
- `src/services/employee-service.ts` calls `assertTenantRole()` before any employee read or write.
- `src/services/review-service.ts` calls both `assertTenantRole()` and `assertEmployeeContext()` before self-review submission.
- `src/services/integration-service.ts` uses `assertTenantRole()` for tenant admins and `assertPlatformRole()` when platform support/admin paths are used.

Tenant isolation:

- Repository context is created in `src/repositories/repository-context.ts` by `toRepositoryContext()`. That file is the handoff from authenticated session to data-access scope.
- Employee queries in `src/repositories/employee-repository.ts` always include `tenantId: ctx.tenantId` in `list()`, `findById()`, `employeeExists()`, `orgUnitExists()`, `create()`, and `update()`.
- Review queries in `src/repositories/review-repository.ts` always include `tenantId: ctx.tenantId` in `listCycles()`, `findSelfReviewContext()`, and `submitSelfReview()`.
- Integration queries in `src/repositories/integration-repository.ts` always include `tenantId: ctx.tenantId` in `listConfigs()`, `findConfigById()`, `listJobs()`, `createJob()`, `findJobById()`, `queueRetry()`, `claimQueuedJobs()`, `completeJob()`, and `addLog()`.
- Audit entries are tenant-owned in `src/repositories/audit-log-repository.ts` inside `create()`, where `tenantId` and `actorUserId` are written from the repository context instead of the request body.

Examples of where requests are rejected:

- Unknown or mismatched demo identity is rejected in `src/lib/auth/session.ts` inside `resolveSession()`.
- A caller without the right tenant role is rejected in `src/lib/auth/permissions.ts` inside `assertTenantRole()`.
- A self-review submission without an employee-linked membership is rejected in `src/lib/auth/permissions.ts` inside `assertEmployeeContext()`.
- An invalid review workflow transition is rejected in `src/services/review-service.ts` inside `submitSelfReview()`.
- A non-retryable integration job status is rejected in `src/services/integration-service.ts` inside `retryJob()`.

Multi-tenancy note:

Multi-tenancy is first-class in this codebase because the product requirements explicitly include a multi-tenant HRIS core. The important review habit is that the tenant boundary does not live in the page or the request JSON. It is established in `src/lib/auth/session.ts`, converted into a repository context in `src/repositories/repository-context.ts`, and then enforced again inside every Prisma query in the repository layer.
