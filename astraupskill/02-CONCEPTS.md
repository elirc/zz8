# 2. Concepts: the review workflow and the integration queue

*Read this after chapter 1. Time: about 25 minutes.*

## Review workflow concepts

Self-review is a state transition, not a generic upsert. A valid command identifies the current tenant, reviewer user, subject employee, cycle, and assignment. The service derives reviewer and subject IDs from the trusted session; the request cannot choose another employee. The cycle must be ACTIVE, the assignment must be SELF, and only NOT_STARTED or IN_PROGRESS can win.

The initial context read supplies a useful error for an already submitted assignment, but it is not the concurrency guarantee. Two requests can read IN_PROGRESS. The repository repeats every security and state predicate in its updateMany call. One request changes one row to SUBMITTED; the other sees count zero and returns null. The service maps null to a conflict without creating a second response.

The response uses create rather than upsert. Upsert would make a late request overwrite the original text if a status predicate were accidentally weakened. The unique assignment relation remains a second safety net. Audit metadata carries cycle and response IDs while the transaction still has the same actor and tenant context.

At the API edge, Zod checks text lengths, rating range, and answer values. It is still valuable to validate again in a service if another caller bypasses the route. Tests should include wrong tenant, wrong subject, closed cycle, submitted assignment, duplicate race, and audit failure.

The tenant predicate is not a convenience filter. It is part of the authorization decision because an ID may be known from another organization. The reviewer and subject predicates provide a second boundary: an employee who belongs to this tenant still cannot submit on a manager or peer assignment by changing a URL. The route’s cycle parameter is treated as an identifier, while the repository confirms its relationship and status.

A useful failure response distinguishes not found from conflict without revealing whether another tenant owns a record. A missing assignment can be a 404, while a known submitted assignment is a 409. Neither response should include raw Prisma errors, passwords, or the submitted text. Audit metadata should identify the response and cycle, but not duplicate the full answer payload.

### A concrete review example

Suppose the browser sends strengths, areasToImprove, accomplishments, rating, and answers but omits any user identifier. The service builds the repository input from the session’s userId and employeeId. This is the desired shape: narrative fields are client-owned, identity fields are server-owned. If a future API needs a delegated reviewer workflow, it should introduce a separate permission and assignment lookup rather than accepting an employeeId silently.

The cycle name in the response is presentation data read from the assignment. Never trust a client-supplied name for authorization. The same rule applies to integration configuration names and requestedByUserId. Display fields can be returned after a tenant-scoped lookup; ownership fields must come from context or a validated relation.

## Integration queue concepts


A queue worker has two separate operations: claim and complete. Claim selects QUEUED rows in creation order with a finite batch size. Each update includes tenant, ID, and status QUEUED. The returned count is the ownership result. A worker must process only rows whose update count is one.

The claim token distinguishes attempts. A job can fail, be retried, and be claimed again while an old process is still finishing. Completion therefore requires tenant, job ID, status RUNNING, and the exact claimToken. An old token cannot mark a newer attempt succeeded or failed. Attempts increment when a claim actually wins, rather than when a row is merely selected or manually retried.

Retry is allowed only from FAILED or RETRY_REQUIRED. The repository performs the conditional status change, retry metadata reset, operational log, and audit event in one transaction. If the audit insert fails, the job remains in its prior terminal state. A concurrent retry that loses the predicate returns null and does not emit another event.

The worker logs completion only after matching completion succeeds. This matters because a stale worker can still finish its in-memory processor after another attempt has taken ownership. A log from that stale process would falsely report a current attempt’s outcome.

### A concrete queue example

At 10:00, two workers read the same three queued rows. Both may see the same candidates, but each conditional update can return one positive count per row. The first winner writes token A and returns the row. The second receives zero for that ID and skips it. If the second worker processes an object retained from its initial read anyway, its completion predicate fails because the row is already RUNNING with token A. This is why the processor must consume only the claimed return list.

When a retry happens, the old completion cannot change the status back to FAILED because the old token no longer matches. A retry reason belongs to the new queued attempt and should not be overwritten by stale worker data. Structured logs should include job ID and attempt number, while secrets and full payloads stay out.

## Glossary

Read this table before chapter 3. Every term below is used without explanation in the rest of the course.

| Term | What it means here |
|---|---|
| **Tenant** | One customer organisation. Every row in this database carries a `tenantId`, and every query filters on it. `tenant_northstar` is the seeded example tenant. |
| **Tenant context** | The `{ tenantId, actorUserId }` object (`src/repositories/repository-context.ts`) that the service derives from the session and hands to every repository call. It is never taken from the request body. |
| **Session** | The authenticated caller. In this demo `requireSession(request)` (`src/lib/auth/session.ts`) reads demo headers; in production it would read a signed cookie. Treat it as trusted, the request body as untrusted. |
| **Repository** | The only class allowed to talk to Prisma for a given area (`src/repositories/review-repository.ts`, `integration-repository.ts`). Services call repositories; routes call services. |
| **Service** | The class that owns business rules and permissions (`src/services/review-service.ts`). It maps failures to `AppError(status, message)`. |
| **Service factory / DI** | `src/services/service-factory.ts` constructs a service with its repositories. `src/services/reviewCycleService.ts` is a one-line singleton wrapper around it. "Dependency injection" here just means the tests can pass a different repository object to the constructor. |
| **`$transaction`** | Prisma's all-or-nothing block. Every write made through the `tx` client either commits together or is discarded together. If the callback throws, nothing is written. |
| **Conditional update (compare-and-set)** | `updateMany({ where: {<every predicate>}, data: {...} })`. The database, not the application, decides whether the row still qualifies. |
| **Zero-rows-as-conflict** | The idiom `if (result.count !== 1) return null;`. Zero updated rows means somebody else got there first (or the row was never ours). Return a 404/409, never retry blindly. |
| **Claim token / lease** | A random value (`crypto.randomUUID()`) written onto a row when a worker takes ownership of it. Later writes must present the same token, so a worker that fell behind cannot finish a job that has since been retried. A "lease" is the same idea with an expiry; this project has no expiry — see chapter 3. |
| **Audit row** | A record in `auditLog` describing who changed what. It is written inside the same transaction as the change, so an audit entry can never exist for a change that did not commit. |
| **Assignment** | A `reviewAssignment` row: one person reviewing one subject for one cycle. `type: "SELF"` means the reviewer and the subject are the same person. |
| **Cycle** | A `reviewCycle` row with status `DRAFT`, `ACTIVE` or `CLOSED`. Submissions are only accepted while the cycle is `ACTIVE`. |
| **Race window** | The gap between reading a row and writing it. Here: both requests run `findSelfReviewContext` and see `IN_PROGRESS` before either runs `updateMany`. Only a predicate inside the write closes it. |
| **Detached result** | A plain object returned after the transaction callback finished, so the caller cannot accidentally keep using a transaction client that is already closed. |

### Predict, then run

Before you open chapter 3, write down your answers:

1. Two browser tabs submit the same self-review at the same moment. How many rows does `reviewResponse` end up with, and what does the second caller see?
2. The `auditLog.create` at the end of `submitSelfReview` throws. Does the assignment stay `SUBMITTED`?
3. A worker claimed job `job-1`, the job failed, an operator retried it, and a *second* worker claimed it. The first worker now calls `completeJob` with its old token. What is the return value?

Then run `npm test -- run src/tests/workflow-atomicity.test.ts` and check your answers against the four test names.
