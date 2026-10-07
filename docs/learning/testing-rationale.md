# Testing Rationale

## `src/tests/auth-permissions.test.ts` — `POST /api/employees` rejects an `EMPLOYEE` actor
Why this matters in production: HR write endpoints are high-risk because a missing role gate turns into unauthorized employee data mutation very quickly.
What bug this catches: route-level auth drift where the UI blocks an action but the API still accepts it.
What a fuller suite would add: coverage for `TENANT_ADMIN`, `HR_ADMIN`, and `MANAGER` variations plus platform-role behavior on ops endpoints.

## `src/tests/validation-boundaries.test.ts` — `createEmployeeSchema` rejects malformed input
Why this matters in production: malformed payloads should fail at the boundary instead of producing partial writes or obscure downstream errors.
What bug this catches: weak input validation around emails, dates, and compensation fields.
What a fuller suite would add: table-driven cases for each employee field and explicit assertions on the returned validation shape.

## `src/tests/review-transition.test.ts` — `ReviewService.submitSelfReview()` rejects an already submitted assignment
Why this matters in production: workflow bugs corrupt trust faster than CRUD bugs because they silently violate process rules.
What bug this catches: duplicate or illegal review submissions after a status transition has already happened.
What a fuller suite would add: happy-path submission, inactive-cycle rejection, wrong-reviewer rejection, and persistence assertions around the response transaction.

## `src/tests/tenant-isolation.test.ts` — tenant-scoped employee reads do not return another tenant's record
Why this matters in production: cross-tenant leaks are among the most severe classes of bugs in a multi-tenant HR system.
What bug this catches: missing tenant filters on owner-scoped reads.
What a fuller suite would add: repository-level integration tests against a seeded database plus write-path isolation tests for updates and deletes.

**Correction:** this test cannot catch a missing tenant filter in the app. It defines its own `InMemoryEmployeeRepository` inside the test file (`src/tests/tenant-isolation.test.ts:16-27`) and asserts against that class. It imports nothing from `src/repositories/`. If someone deleted `tenantId: ctx.tenantId` from `src/repositories/employee-repository.ts:63`, this test would still pass. It documents the contract; it does not test the code. Also, "write-path isolation tests for updates and deletes": there is no delete path anywhere in the app.

## `src/tests/workflow-atomicity.test.ts`: transaction-shaped workflow contracts (added with the atomicity fix)

Four tests (`describe` at line 160):

| Test (line) | What it exercises | Strength |
| --- | --- | --- |
| `does not commit a self-review assignment when its audit insert fails` (165) | the **real** `ReviewService` and `ReviewRepository` against an in-memory Prisma double (`vi.mock("@/lib/db")`, line 41) whose `$transaction` snapshots and restores the tables | Strong for the grouping of the three writes: if the audit write moved outside the transaction, the assignment would stay `SUBMITTED` and the test would fail |
| `lets exactly one of two concurrent submissions claim the assignment` (184) | the same real code, two parallel `submitSelfReview` calls | Pins the conditional `updateMany` in `review-repository.ts:106-121`, as far as the double evaluates `where` the way Prisma would |
| `writes nothing when the subject employee predicate does not match` (206) | the real repository with a mismatched `subjectEmployeeId` | Pins one of the new identity predicates |
| `completes only the worker holding the immutable claim token` (223) | the real `processQueuedIntegrationJobs` loop with a **hand-written fake repository** whose `claimQueuedJobs` and `completeJob` implement the token rule themselves (lines 228-240) | Weak for the repository. It proves the worker passes `claimToken` through and logs only on success. Deleting `status: "QUEUED"` or `claimToken` from the real `IntegrationRepository` (`integration-repository.ts:188`, `:222`) would not fail it |

---

## Does `npm test` run these tests?

| Question | Answer | Evidence |
| --- | --- | --- |
| Which files does Vitest pick up? | `src/tests/**/*.test.ts`, i.e. all five files (four original plus `workflow-atomicity.test.ts`) | `vitest.config.ts:7` |
| Does `npm test` run once? | In an interactive terminal, no: `vitest` with no subcommand starts **watch mode**. In CI (non-TTY) it runs once. Use `npm run test:run` for a one-shot run with coverage. | `package.json:10-11` |
| Does it need a database? | No. None of the original four tests reaches a Prisma query, and `workflow-atomicity.test.ts` replaces `@/lib/db` with an in-memory double. | see per-test table below |
| Does it need `prisma generate`? | Very likely yes for `auth-permissions.test.ts`: it imports the route, which imports `service-factory.ts`, which constructs repositories that import `src/lib/db.ts`, which imports `@prisma/client` and runs `new PrismaClient({ adapter })` **at import time** (`src/lib/db.ts:19-24`). Without a generated client that import fails. (by reading; not run, no `node_modules` in this checkout) | `src/lib/db.ts:8` |
| Was the suite green when these docs were written? | Unknown. `node_modules` is absent here and installing was out of scope, so Vitest was not run. The build journal's "green tests" claim (Stage 5) could not be re-verified, and `astraupskill/VERIFICATION.md` keeps no run record in this repo. | |

## What each test proves, and what it does not

| Test | Proves | Does not prove |
| --- | --- | --- |
| `auth-permissions` | The real route, real session resolver, real service and real `handleRouteError` return 403 with "cannot create employees" for `user_employee` with a **valid** body (`auth-permissions.test.ts:14-40`). | That invalid bodies from an employee return 403 (they return 500, finding A2). That anyone is *allowed*: there is no positive case. Any other route or role. The headerless case (finding A1). |
| `validation-boundaries` | `safeParse` fails for a payload with **three** bad fields at once (`workEmail`, `compensationCents: -10`, `startDate: "not-a-date"`, lines 18-24). | Which field failed. If the email rule were deleted, the test would still pass because the other two fields are still bad. It also does not test what the **route** returns for that input (500 today). |
| `review-transition` | `ReviewService.submitSelfReview` throws `{ status: 409, message: "This self-review has already been submitted." }` when the repository reports `SUBMITTED` (lines 43-54). | That `submitSelfReview` on the repository was not called (the mock `vi.fn()` at line 36 is never asserted). The ACTIVE-cycle 409, the 404, the employee-context 403. That `APPROVED` is blocked (the service does not block it, finding R1; the repository's conditional write now does). Concurrency (finding L4, now covered by `workflow-atomicity.test.ts:184`). |
| `tenant-isolation` | That a 10-line in-memory class in the test file filters by tenant. | Anything about `src/repositories/` (see the correction above). |

Note: the fake data in `review-transition.test.ts` uses `cycle_midyear_2026` and `assignment_self_sam`, which do not match the seed (`cycle_2026_h1`, `assignment_self_sam_h1`). That is harmless because the repository is faked, but it shows the test is not tied to the seeded scenario.

## Checks that were run for these docs

Because dependencies are not installed, the real Vitest suite was not run. Instead, the pure logic was exercised directly. These checks ran on the code **before** the atomicity fix: the `git archive` copy came from the snapshot this documentation was first written against. Checks J1, J2, J3, J4, J6, J8, R1 and R5 describe behavior that has since changed. The "pass" in their rows means the old bug reproduced, and request-lifecycle.md (L1, L3, L4) and domain-model.md say what the code does now. The repo's `src/` was copied with `git archive HEAD src | tar -x` into a scratch folder outside the repo, and a small Node resolve hook mapped `@/...` imports to that copy and replaced four modules:

| Replaced module | Replacement | Why |
| --- | --- | --- |
| `@/lib/db` | an in-memory store implementing only the Prisma calls that `IntegrationRepository` and `AuditLogRepository` make; every call awaits one `setImmediate` so parallel callers interleave | no PostgreSQL; and so races can be modelled |
| `@prisma/client`, `@prisma/adapter-pg` | empty stand-ins (only imported for types and the unused client) | not installed |
| `next/server` | `NextResponse.json = Response.json` | not installed; only status and body are inspected |
| `zod` | not provided; anything that imports Zod at runtime (routes, schemas) was **not** run | not installed |

Command (Node 22.16.0, from the scratch folder):

```
node --experimental-transform-types --no-warnings --import ./register.mjs --test tests/*.test.ts
```

`--experimental-transform-types` (not `--experimental-strip-types`) is needed because the service classes use TypeScript constructor parameter properties (`constructor(private readonly deps: ...)`, for example `src/services/employee-service.ts:27`), which strip-only mode rejects.

Result: **38 tests, 38 pass, 0 fail.**

| Id | What it checks | Real code exercised | Result |
| --- | --- | --- | --- |
| S1 | No headers -> `user_hr_admin`, HR_ADMIN, northstar | `resolveSession` | pass (confirms finding A1) |
| S2 | Unknown user -> 401 | `resolveSession` | pass |
| S3 | Employee + `tenant_atlas` -> 403 | `resolveSession` | pass |
| S4 | User header only -> tenant falls back to northstar for all five users | `resolveSession` | pass |
| S5 | Tenant header only (atlas) -> 403 | `resolveSession` | pass |
| S6 | Platform admin may name `tenant_atlas` and a non-existent tenant | `resolveSession` | pass (A3) |
| S7 | Empty user header -> 401 | `resolveSession` | pass |
| S8 | `requireSession`'s 401 is unreachable | `requireSession`, `demoSessions` | pass (A7) |
| S9 | No PLATFORM_SUPPORT demo session | `demoSessions` | pass (A5) |
| E1 | `AppError(409)` -> 409 with `{ error: { message } }` | `handleRouteError` | pass |
| E2 | Non-AppError (ZodError stand-in) -> 500 "Unexpected server error." | `handleRouteError` | pass (A2) |
| E3 | Malformed JSON -> `SyntaxError` -> 500 | `Request.json`, `handleRouteError` | pass (A2) |
| E4 | Empty body -> `SyntaxError` | `Request.json` | pass |
| J1 | Two parallel sweeps both complete the same job; two logs | `IntegrationService`, `IntegrationRepository`, `processQueuedIntegrationJobs` | pass (L1) |
| J2 | Two parallel claims return the same rows | `claimQueuedJobs` | pass (L1) |
| J3 | Claimed rows are returned with stale status QUEUED | `claimQueuedJobs` | pass |
| J4 | Processing does not increment `attemptCount` | sweep | pass |
| J5 | `simulateFailure` -> FAILED, fixed message, ERROR log | sweep | pass |
| J6 | Retry allowed only from FAILED/RETRY_REQUIRED; resets fields; `attemptCount` +1 | `retryJob`, `queueRetry` | pass |
| J7 | 25 retries accepted | `retryJob` | pass (L5) |
| J8 | Two parallel retries both succeed; `attemptCount` 2; two audit rows | `retryJob` | pass (L3) |
| J9 | Failure mid-batch leaves jobs RUNNING; retry 409; next sweep finds nothing | sweep, `retryJob` | pass (L2) |
| J10 | Paused config accepts new jobs | `queueJob` | pass |
| J11 | Other tenant's config -> 404 | `queueJob` | pass |
| J12 | Queue and sweep write no audit rows | `queueJob`, sweep | pass |
| J13 | Other tenant's job -> 404 | `retryJob` | pass |
| J14 | Platform admin with `tenant_atlas` sweeps Atlas jobs | sweep | pass (A3) |
| J15 | Sequential second retry -> 409 | `retryJob` | pass |
| G1 | 5 sessions x 11 service methods permission matrix | all three services (fake repositories) | pass; table in auth-and-permissions.md |
| G2 | A constructed PLATFORM_SUPPORT session passes integration gates, fails employee gates | services | pass (A5) |
| G3 | An employee can be made their own manager | `updateEmployee` | pass |
| G4 | Unknown manager -> 400 | `updateEmployee` | pass |
| G5 | Missing employee on update -> 404 | `updateEmployee` | pass |
| R1 | APPROVED assignment can be re-submitted | `submitSelfReview` | pass (domain-model.md) |
| R2 | DRAFT/CALIBRATING/COMPLETED cycle -> 409 | `submitSelfReview` | pass |
| R3 | No assignment -> 404 | `submitSelfReview` | pass |
| R4 | Platform admin (no `employeeId`) -> 403 | `submitSelfReview` | pass |
| R5 | Two parallel submissions both succeed; two audit rows | `submitSelfReview` (fake repo that yields) | pass (L4) |

Limits of these checks: the in-memory store does not model PostgreSQL isolation, locking or Prisma's exact return shapes; it shows that the **code** has no guard, not how often the race fires in production. Zod schemas were reviewed by reading only.

## Tests worth adding, tied to findings

| Priority | Test | Finding | Notes |
| --- | --- | --- | --- |
| 1 | Route test: `POST /api/employees` with no headers expects 401 | A1 | Fails today; flip after fixing the default. |
| 2 | Route test: invalid body expects 400 with field details; body `"{"` expects 400 | A2 | Fails today (500). |
| 3 | Repository test against a real Postgres: two concurrent `claimQueuedJobs` return disjoint sets | L1 | The atomic claim now exists (`integration-repository.ts:182-207`), but no test runs the real repository. Use the seeded `job_queued_greenhouse`. |
| 4 | Service test: two concurrent `retryJob` calls, exactly one fulfilled, the other 409 | L3 | Today the loser gets 404 (`integration-service.ts:100-102`). Write the test, then change the code to 409. |
| 5 | Sweep test: a throwing `completeJob` leaves the job FAILED, not RUNNING | L2 | |
| 6 | Service test: submitting an `APPROVED` assignment -> 409 | R1 | Today it gets 404 from the null-result branch (`review-service.ts:84-86`). |
| 7 | Replace `tenant-isolation.test.ts` with a test of the real `EmployeeRepository.findById` (seeded DB, or a mocked `db` asserting the `where` contains `tenantId`) | correction above | |
| 8 | Split `validation-boundaries` into one case per field (table-driven) and assert `result.error.issues[0].path` | weak assertion | |
| 9 | Permission matrix test over all sessions | G1 | Pins the whole policy; one-cell diffs on change. |
| 10 | `listEmployees` as MANAGER does not expose `compensationCents` | A6 | Policy decision first. |

## Exercises

1. Delete the `tenantId` line from `EmployeeRepository.findById` in a scratch copy. Which existing test fails? Answer: none. `tenant-isolation.test.ts` does not import the repository, and the other tests never reach it.
2. Change `createEmployee`'s allowed roles to include `EMPLOYEE`. Which test fails? Answer: `auth-permissions.test.ts`, because the 403 assertion at line 39 now gets 201 (or 500 if the DB is not reachable).
3. Remove `.email()` from `workEmail` in `employeeSchemas.ts`. Does `validation-boundaries.test.ts` fail? Answer: no. `compensationCents: -10` and `startDate: "not-a-date"` still make `safeParse` fail.
