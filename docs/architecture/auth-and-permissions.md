# Auth And Permissions

This codebase uses a demo-session adapter instead of a production identity provider, but the authorization boundaries are still explicit and centralized.

Session flow:

- Request identity is resolved in `src/lib/auth/session.ts` by `resolveSession()` and `requireSession()`.
- API routes call `buildRouteContext()` in `src/lib/http/route-context.ts`, which is the only place the route layer turns an HTTP request into an authenticated session.
- The browser sends the demo actor through `src/lib/http/client.ts`, which reads `DEMO_SESSION_STORAGE_KEY` from `src/lib/demo/demo-sessions.ts`.
  - **Clarification:** the hooks always pass `demoHeaders` from the React context (`src/hooks/useEmployees.ts:37`, `useReviewCycles.ts:34`, `useIntegrationOps.ts:66,78`), so in practice `apiFetch()` uses `input.demoHeaders` (`src/lib/http/client.ts:46`). The `localStorage` read in `getStoredDemoHeaders()` (`client.ts:20-36`) is only a fallback for callers that omit `demoHeaders`, and no current caller does.
- UI role switching lives in `src/components/providers/demo-session-provider.tsx`, so feature panels do not own auth-like state.

Role enforcement:

- Tenant role checks are centralized in `src/lib/auth/permissions.ts` inside `assertTenantRole()`.
- Platform role checks are centralized in `src/lib/auth/permissions.ts` inside `assertPlatformRole()`.
- Employee-linked workflow checks are centralized in `src/lib/auth/permissions.ts` inside `assertEmployeeContext()`.
- `src/services/employee-service.ts` calls `assertTenantRole()` before any employee read or write.
- `src/services/review-service.ts` calls both `assertTenantRole()` and `assertEmployeeContext()` before self-review submission.
- `src/services/integration-service.ts` uses `assertTenantRole()` for tenant admins and `assertPlatformRole()` when platform support/admin paths are used.
  - **Correction:** `assertPlatformRole()` is called in exactly one place, `processQueuedJobs()` (`src/services/integration-service.ts:115-119`), and only inside the branch that already established the caller is `PLATFORM_ADMIN` or `PLATFORM_SUPPORT` (line 126). The call can never throw. The real platform bypass for integrations is the early `return` in `assertIntegrationAccess()` (lines 150-152). See finding A5.

Tenant isolation:

- Repository context is created in `src/repositories/repository-context.ts` by `toRepositoryContext()`. That file is the handoff from authenticated session to data-access scope.
- Employee queries in `src/repositories/employee-repository.ts` always include `tenantId: ctx.tenantId` in `list()`, `findById()`, `employeeExists()`, `orgUnitExists()`, `create()`, and `update()`.
- Review queries in `src/repositories/review-repository.ts` always include `tenantId: ctx.tenantId` in `listCycles()`, `findSelfReviewContext()`, and `submitSelfReview()`.
- Integration queries in `src/repositories/integration-repository.ts` always include `tenantId: ctx.tenantId` in `listConfigs()`, `findConfigById()`, `listJobs()`, `createJob()`, `findJobById()`, `queueRetry()`, `claimQueuedJobs()`, `completeJob()`, and `addLog()`.
- Audit entries are tenant-owned in `src/repositories/audit-log-repository.ts` inside `create()`, where `tenantId` and `actorUserId` are written from the repository context instead of the request body.

(Verified by reading: all 21 Prisma calls in `src/repositories/` carry `tenantId: ctx.tenantId`. Cross-tenant ids return 404 in the service layer, which was run for jobs and configs: tests J11 and J13 in the scratch harness.)

Examples of where requests are rejected:

- Unknown or mismatched demo identity is rejected in `src/lib/auth/session.ts` inside `resolveSession()`.
  - **Correction:** *missing* identity is not rejected. When `x-demo-user-id` is absent, `resolveSession()` substitutes `DEFAULT_DEMO_SESSION.userId`, which is `user_hr_admin`, an `HR_ADMIN` (`src/lib/auth/session.ts:17`, `src/lib/demo/demo-sessions.ts:13-20`). Only an **unknown** user id (401) or a **mismatched** tenant (403) is rejected. See finding A1. (run)
- A caller without the right tenant role is rejected in `src/lib/auth/permissions.ts` inside `assertTenantRole()`.
- A self-review submission without an employee-linked membership is rejected in `src/lib/auth/permissions.ts` inside `assertEmployeeContext()`.
  - **Clarification:** "membership" here means the `employeeId` field on the hard-coded demo session, not a `TenantMembership` row. No code reads the `TenantMembership` table (finding A4). In the demo data only `user_platform_admin` lacks an `employeeId` (`demo-sessions.ts:23-29`).
- An invalid review workflow transition is rejected in `src/services/review-service.ts` inside `submitSelfReview()`.
- A non-retryable integration job status is rejected in `src/services/integration-service.ts` inside `retryJob()`.

Multi-tenancy note:

Multi-tenancy is first-class in this codebase because the product requirements explicitly include a multi-tenant HRIS core. The important review habit is that the tenant boundary does not live in the page or the request JSON. It is established in `src/lib/auth/session.ts`, converted into a repository context in `src/repositories/repository-context.ts`, and then enforced again inside every Prisma query in the repository layer.

**Clarification:** the tenant boundary does not live in the request JSON, but it **does** live in a request header (`x-demo-tenant-id`). For ordinary users `resolveSession()` only accepts their own hard-coded tenant (`session.ts:26-28`). For the platform admin it accepts any string at all (finding A3). In a real deployment, both the user and the tenant would have to come from a verified token, not a header.

---

## Inside the auth wrapper

Every route runs this sequence before any business logic. The code is short enough to walk line by line.

**Step 1. The route calls `buildRouteContext(request)`** (`src/lib/http/route-context.ts:9-13`). It returns `{ session: requireSession(request) }`. Nothing else is in the context.

**Step 2. `requireSession()` calls `resolveSession()`** (`src/lib/auth/session.ts:36-37`).

**Step 3. `resolveSession()` reads two headers with fallbacks** (`session.ts:17-19`):

```ts
const userId   = request.headers.get("x-demo-user-id")   ?? "user_hr_admin";
const tenantId = request.headers.get("x-demo-tenant-id") ?? "tenant_northstar";
```

`??` only replaces `null`. A header that is present but empty (`""`) is kept as `""`.

**Step 4. Look up the user in the in-memory directory** (`session.ts:20`): `demoSessions[userId]`. No database query. If nothing matches, throw `AppError(401, "Unknown demo session.")` (lines 22-24).

**Step 5. Tenant check** (`session.ts:26-28`): if the session is not `PLATFORM_ADMIN` and its hard-coded `activeTenantId` differs from the header tenant, throw `AppError(403, "Requested tenant does not match the authenticated membership.")`.

**Step 6. Return a copy with the requested tenant** (`session.ts:30-33`): `{ ...session, activeTenantId: tenantId }`. For ordinary users this is the same tenant they already had. For the platform admin it is whatever the header said.

**Step 7. `requireSession()` checks `session.userId`** (`session.ts:39-41`) and would throw `AppError(401, "Authentication required.")`. Every entry in `demoSessions` has a non-empty `userId`, so this branch cannot fire (run, test S8).

**Step 8. The service runs its guard** (`assertTenantRole`, `assertEmployeeContext`, or the integration helper). A failure throws `AppError(403, ...)`.

**Step 9. Any thrown error reaches `handleRouteError()`** (`src/lib/http/api-response.ts:19-40`). An `AppError` becomes `{ error: { message, details } }` with its own status. **Anything else** (including `ZodError` and the `SyntaxError` from `request.json()`) is logged with `console.error` and becomes **500** `{ error: { message: "Unexpected server error." } }`.

### Header resolution truth table (run)

All rows were executed against the real `resolveSession()` (scratch tests S1-S7).

| `x-demo-user-id` | `x-demo-tenant-id` | Result |
| --- | --- | --- |
| absent | absent | 200-path session: `user_hr_admin`, `HR_ADMIN`, `tenant_northstar` |
| absent | `tenant_atlas` | 403 (falls back to HR admin, whose tenant is northstar) |
| `nobody` | any | 401 "Unknown demo session." |
| `""` (empty) | any | 401 (empty string is not nullish) |
| any of the 5 ids | absent | session in `tenant_northstar` (every demo user belongs there) |
| `user_employee` | `tenant_atlas` | 403 "Requested tenant does not match..." |
| `user_platform_admin` | `tenant_atlas` | session with `activeTenantId: "tenant_atlas"` |
| `user_platform_admin` | `tenant_does_not_exist` | session with that tenant id; queries simply return empty lists |

### The demo directory

| Session id | `tenantRole` | `platformRole` | `employeeId` | Evidence |
| --- | --- | --- | --- | --- |
| `user_platform_admin` | TENANT_ADMIN | PLATFORM_ADMIN | (none) | `demo-sessions.ts:23-29` |
| `user_hr_admin` | HR_ADMIN | NONE | `emp_alex` | `demo-sessions.ts:13-20,30` |
| `user_manager` | MANAGER | NONE | `emp_morgan` | `demo-sessions.ts:31-38` |
| `user_employee` | EMPLOYEE | NONE | `emp_sam` | `demo-sessions.ts:39-46` |
| `user_integration_admin` | INTEGRATION_ADMIN | NONE | `emp_ivy` | `demo-sessions.ts:47-54` |

No session has `PLATFORM_SUPPORT` (run, test S9), even though the enum declares it (`src/lib/domain.ts:7`) and the integration service grants it access.

### The three guards

| Guard | Code | Passes when | Throws |
| --- | --- | --- | --- |
| `assertTenantRole(session, roles, action)` | `permissions.ts:10-24` | `platformRole === "PLATFORM_ADMIN"` **or** `tenantRole` is in `roles` | 403 `The <tenantRole> role cannot <action>.` |
| `assertPlatformRole(session, roles, action)` | `permissions.ts:26-34` | `platformRole` is in `roles` | 403 `The caller cannot <action>.` |
| `assertEmployeeContext(session)` | `permissions.ts:36-40` | `session.employeeId` is truthy | 403 `This action requires an employee-linked tenant membership.` |

Note the asymmetry: `assertTenantRole` lets `PLATFORM_ADMIN` through but not `PLATFORM_SUPPORT`. The integration service's private helper `assertIntegrationAccess` (`integration-service.ts:131-137`) lets both through.

## Route-by-route gate table

| Route | Handler (file:line) | Service method (file:line) | Guard and allowed roles | Extra service-level checks |
| --- | --- | --- | --- | --- |
| `GET /api/employees` | `employees/route.ts:12-20` | `listEmployees` `employee-service.ts:29-37` | `assertTenantRole` TENANT_ADMIN, HR_ADMIN, MANAGER | none; returns the whole tenant |
| `POST /api/employees` | `employees/route.ts:22-31` | `createEmployee` `employee-service.ts:58-77` | `assertTenantRole` TENANT_ADMIN, HR_ADMIN | `managerId` and `orgUnitId` must exist in the tenant (400) |
| `GET /api/employees/:id` | `[employeeId]/route.ts:18-27` | `getEmployee` `employee-service.ts:39-56` | `assertTenantRole` TENANT_ADMIN, HR_ADMIN, MANAGER | 404 if not in tenant |
| `PATCH /api/employees/:id` | `[employeeId]/route.ts:29-39` | `updateEmployee` `employee-service.ts:79-105` | `assertTenantRole` TENANT_ADMIN, HR_ADMIN | same reference checks; 404 if not in tenant |
| `GET /api/review-cycles` | `review-cycles/route.ts:11-19` | `listCycles` `review-service.ts:26-34` | `assertTenantRole` TENANT_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE | none; returns all cycles in the tenant |
| `POST /api/review-cycles/:cycleId/submit-self-review` | `submit-self-review/route.ts:12-29` | `submitSelfReview` `review-service.ts:36-93` | `assertTenantRole` same four roles, then `assertEmployeeContext` | SELF assignment for (cycle, user, employee) must exist (404); cycle must be ACTIVE (409); assignment must not be SUBMITTED (409) |
| `GET /api/integration-configs` | `integration-configs/route.ts:11-19` | `listConfigs` `integration-service.ts:38-41` | `assertIntegrationAccess`: platform ADMIN/SUPPORT, else TENANT_ADMIN, INTEGRATION_ADMIN | none |
| `GET /api/integration-jobs` | `integration-jobs/route.ts:12-20` | `listJobs` `integration-service.ts:43-46` | same | newest 20 only (`integration-repository.ts:55`) |
| `POST /api/integration-jobs` | `integration-jobs/route.ts:22-31` | `queueJob` `integration-service.ts:48-72` | same | config must exist in tenant (404); `isActive` **not** checked |
| `POST /api/integration-jobs/:jobId/retry` | `[jobId]/retry/route.ts:12-25` | `retryJob` `integration-service.ts:74-105` | same | job must exist in tenant (404); status must be FAILED or RETRY_REQUIRED (409) |
| `POST /api/integration-jobs/process` | `process/route.ts:12-21` | `processQueuedJobs` `integration-service.ts:107-129` | platform ADMIN/SUPPORT, else `assertTenantRole` TENANT_ADMIN, INTEGRATION_ADMIN | batch size 1-20 from the schema |

## Permission matrix (run)

Each cell is the result of calling the real service method with that demo session and permissive fake repositories (scratch test G1). "allow" means every guard passed. For self-review, the fake repository always returns an ACTIVE, IN_PROGRESS assignment, so "allow" means "passes the gates if an assignment exists". With the seed data, only `user_employee` actually has SELF assignments (`prisma/seed.ts:297-325`); the HR admin and manager would get 404.

| Session | list emp | get emp | create emp | update emp | list cycles | submit self | list configs | list jobs | queue job | retry job | process |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| platform admin | allow | allow | allow | allow | allow | 403 | allow | allow | allow | allow | allow |
| HR admin | allow | allow | allow | allow | allow | allow | 403 | 403 | 403 | 403 | 403 |
| manager | allow | allow | 403 | 403 | allow | allow | 403 | 403 | 403 | 403 | 403 |
| employee | 403 | 403 | 403 | 403 | allow | allow | 403 | 403 | 403 | 403 | 403 |
| integration admin | 403 | 403 | 403 | 403 | 403 | 403 | allow | allow | allow | allow | allow |

Things the matrix makes obvious:

- The platform admin passes every gate except self-review (no `employeeId`, test R4).
- The default session (HR admin) gets 403 on the whole Integrations page. Opening `/integrations` without switching roles shows three error messages; that is expected behavior, not a bug.
- The integration admin, who is also an employee (`emp_ivy`), cannot even list review cycles. Whether integration admins should take part in reviews is a product decision, but the code currently excludes them.

## Findings

Each finding has evidence, a label, and a fix sketch.

### A1. Headerless requests are an HR admin (run)

- Evidence: `src/lib/auth/session.ts:17-19` falls back to `DEFAULT_DEMO_SESSION`, which is `user_hr_admin` / `HR_ADMIN` (`src/lib/demo/demo-sessions.ts:13-20`). Scratch test S1 confirms `resolveSession(new Request(url))` returns an `HR_ADMIN` session.
- Impact: `curl -X POST /api/employees` with a valid body and **no headers at all** passes the `createEmployee` gate. Any script, health check, or server component that forgets the headers acts as HR. The server-side fallback in `client.ts:21-26` uses the same default, and so does the provider's initial state (`demo-session-provider.tsx:39-46`).
- Fix sketch: make a missing header a 401 (`if (!userIdHeader) throw new AppError(401, "Authentication required.")`). That also makes `requireSession()`'s dead 401 meaningful. If a default is wanted for demos, default to the least privileged session (`user_employee`).

### A2. Bad input returns 500, not 400 (run, with a stand-in for ZodError)

- Evidence: every route calls `schema.parse(await request.json())` inside the `try` (for example `src/app/api/employees/route.ts:25`). `parse` throws a `ZodError`; `request.json()` throws a `SyntaxError` on malformed or empty bodies. `handleRouteError()` only recognizes `AppError` (`src/lib/http/api-response.ts:20`), so both fall through to the 500 branch (lines 32-40).
- What was run: `handleRouteError(new SomeErrorSubclass())` returns 500 with `"Unexpected server error."` (test E2); a real `new Request(url, { method: "POST", body: "{not json" }).json()` throws `SyntaxError`, which also maps to 500 (tests E3, E4). Zod itself is not installed in this checkout, so the `ZodError` was represented by a plain `Error` subclass. Since `isAppError` is an `instanceof AppError` check (`app-error.ts:19-21`), any class that is not `AppError` behaves the same way.
- Impact: clients cannot tell "you sent bad data" from "the server broke". The `details` field that `AppError` supports (`app-error.ts:9`) is never filled with validation issues. The UI shows "Unexpected server error." for a typo (`client.ts:63-65`). Server logs fill with `console.error` for routine user mistakes.
- Also affected: a Prisma unique-constraint error, for example creating a second employee with the same `employeeNumber` in a tenant (`prisma/schema.prisma:201`), also becomes 500 (by reading).
- Fix sketch: in `handleRouteError`, map `error instanceof ZodError` to 400 with `details: error.issues`, `error instanceof SyntaxError` to 400 `"Body must be valid JSON."`, and Prisma `P2002` to 409.

### A3. The tenant comes from a header, and the platform admin can name any tenant (run)

- Evidence: `session.ts:26` skips the tenant check for `PLATFORM_ADMIN`; line 32 copies the header value into `activeTenantId`. Test S6 shows `tenant_does_not_exist` is accepted. Test J14 shows a platform admin naming `tenant_atlas` can run the processing sweep over Atlas's queue.
- Impact: for a real platform operator role this may be intended, but nothing records which tenant they acted in other than the audit row's `tenantId`, and nothing checks the tenant exists.
- Fix sketch: when the platform admin switches tenant, look the tenant up (`db.tenant.findUnique`) and 404 if it is missing; write an audit entry for cross-tenant access.

### A4. Tenant memberships and users are never read at runtime (by reading)

- Evidence: a search for every `db.<model>.<method>` call in `src/` finds 21 calls on `employee`, `orgUnit`, `reviewCycle`, `reviewAssignment`, `reviewResponse`, `integrationConfig`, `integrationJob`, `integrationLog` and `auditLog`. None touch `tenant`, `tenantMembership` or `user`. Roles come only from the hard-coded `demoSessions` object.
- Impact: changing a role in the database (`TenantMembership.role`, `prisma/schema.prisma:143`) has no effect. The seed's memberships (`prisma/seed.ts:199-240`) are documentation, not configuration. If the two drift, the code wins silently.
- Fix sketch: in a real adapter, resolve `(userId, tenantId)` to a `TenantMembership` row (there is already a unique index on `[tenantId, userId]`, `schema.prisma:150`) and take `role` and `employeeId` from it.

### A5. `PLATFORM_SUPPORT` is half-wired, and one guard call is a no-op (run + by reading)

- Evidence: no demo session has `PLATFORM_SUPPORT` (test S9). If one existed, it would pass every integration gate through `assertIntegrationAccess` (`integration-service.ts:132-134`) but fail every employee and review gate, because `assertTenantRole` only bypasses `PLATFORM_ADMIN` (`permissions.ts:16`). Test G2 constructs such a session and confirms both behaviors. Separately, `processQueuedJobs` calls `assertPlatformRole(session, ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"])` only after checking that `platformRole` is one of those two values (`integration-service.ts:108-119`), so that call cannot fail.
- Impact: none today, but it is easy to believe `assertPlatformRole` is protecting something. It is the only call site, so the function is effectively unused.
- Fix sketch: replace the if/else in `processQueuedJobs` with `this.assertIntegrationAccess(session, "process integration jobs")`, which is what the other four integration methods use. Decide explicitly whether support staff may read HR data, and add a demo session for it so the behavior is testable.

### A6. Managers can see every employee's compensation (run + by reading)

- Evidence: `listEmployees` and `getEmployee` admit `MANAGER` (`employee-service.ts:30-34,40-44`; matrix above). The repository query uses `include` for `manager` and `orgUnit` (`employee-repository.ts:46-53`), which in Prisma returns **all scalar fields** of the employee, including `compensationCents`, `currency` and `workEmail`. `mapEmployee` is an identity function (`employee-repository.ts:12-28`). There is no filter by reporting line: the query is `where: { tenantId }` only (line 34).
- Impact: Morgan (manager) can read Alex's (HR admin, her own manager) salary. The UI does not render the column, and its copy says compensation context "stay[s] server-owned" (`employee-directory.tsx:48`), but the JSON in the network tab contains it. `useEmployees` even types it (`src/hooks/useEmployees.ts:34`).
- Fix sketch: give the repository a `select` that omits compensation for non-HR roles, or restrict managers to `managerId = session.employeeId` (direct reports).

### A7. `requireSession()`'s 401 is dead code (run)

- Evidence: `session.ts:39-41` checks `session.userId`, but `resolveSession` only returns entries from `demoSessions`, all of which have a non-empty `userId` (test S8).
- Impact: the function name suggests it enforces authentication; it does not add anything beyond `resolveSession`. Combined with A1, there is no path that yields "Authentication required."
- Fix sketch: move the missing-header check (A1) here.

### A8. The tenant match message talks about a membership that is never loaded (by reading)

- Evidence: the 403 text "Requested tenant does not match the authenticated membership." (`session.ts:27`) compares against a hard-coded `activeTenantId`, not a membership row (see A4).
- Impact: misleading when debugging. Low severity.

### Checked and not present

- **`*/`-in-comment route killers:** no block comment in `src/` or `prisma/` contains a literal `*/` before its end. The only `*/` sequences outside comment terminators are the cron strings `"0 */4 * * *"` and `"15 */6 * * *"` in `prisma/seed.ts:350,359`, which are inside string literals and harmless.
- **IDOR on ids from the URL:** `employeeId`, `jobId` and `cycleId` are always combined with `tenantId: ctx.tenantId` in the repository (`employee-repository.ts:62-65`, `integration-repository.ts:91-94`, `review-repository.ts:58-64`). A northstar user asking for an Atlas job id gets 404 (test J13).
- **Self-review for someone else:** the repository query pins `reviewerUserId: session.userId` **and** `subjectEmployeeId: session.employeeId` **and** `type: "SELF"` (`review-service.ts:50-54`, `review-repository.ts:58-64`). There is no body field that can change the subject.

## Tests worth adding, tied to findings

| Finding | Test | Where |
| --- | --- | --- |
| A1 | `GET /api/employees` with no headers expects 401 (today it returns the directory). | new route test next to `src/tests/auth-permissions.test.ts` |
| A2 | `POST /api/employees` as HR admin with `workEmail: "x"` expects 400 and `details` listing `workEmail`. Same with body `"{"` expecting 400. | same |
| A3 | `resolveSession` as platform admin with an unknown tenant expects 404 once the lookup exists. | unit test on `session.ts` |
| A5 | A `PLATFORM_SUPPORT` session calling `listEmployees` and `listJobs`, pinning whichever policy is chosen. | unit test on the services |
| A6 | `listEmployees` as MANAGER expects no `compensationCents` in the payload (or only direct reports). | repository-level test against a seeded DB |
| Matrix | A table-driven test over the five sessions and eleven service methods, so a role change shows up as a one-cell diff. | unit test with fake repositories (the scratch test G1 is a template) |
