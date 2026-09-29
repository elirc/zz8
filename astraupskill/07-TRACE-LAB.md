# 7. Trace lab: one request, six boundaries

*Time: about 45 minutes. Do this with the six files open in tabs, in order. The point is not to understand each file — it is to see where the request stops being a blob of JSON and starts being a row.*

Trace one request: **Sam Employee submits their self-review for the Midyear cycle.** At each boundary, write down what the data looks like *on the way in*, what is added or removed, and what would happen if that boundary were missing.

## Boundary 1 — the form component

`src/components/reviews/review-cycle-panel.tsx:129-150`. The submit button's `onClick` guards on `cycleId` and then calls `submitMutation.mutateAsync({ cycleId, input: { strengths, areasToImprove, accomplishments, overallRating: 4, answers: {...} } })`. Three of those values come from `useState` bound to textareas; `overallRating` and `answers` are hard-coded demo values.

Notice what the component does **not** send: no user id, no employee id, no tenant. The identity of the submitter is not a form field. That is the single most important design decision in the whole trace — if the component sent `employeeId`, every boundary downstream would have to decide whether to believe it.

*If this boundary were missing:* nothing security-relevant. The client is untrusted; it can be replaced by `curl`. Client-side checks here exist to save a round trip, not to enforce anything.

## Boundary 2 — the mutation hook and the fetch wrapper

`src/hooks/useReviewCycles.ts:47-70` (`useSubmitSelfReview`) wraps the call in TanStack Query's `useMutation` and calls `apiFetch("/api/review-cycles/<cycleId>/submit-self-review", { method: "POST", body: input })` (a template literal in the source).

`src/lib/http/client.ts:38-66` is where the request is actually serialised. It sets `content-type: application/json`, `JSON.stringify`s the body, and attaches the two demo headers from `getStoredDemoHeaders()` — the user id and tenant id of whichever seeded demo session is selected in `localStorage`. On the way back it unwraps `{ data }` and throws `new Error(payload.error.message)` for any non-2xx.

*This is the demo's stand-in for authentication.* In a real application those two headers would be a signed session cookie or a bearer token. Read them as "the identity the server will trust", and keep in mind that in this demo a curious user can change them — which is exactly why the tenant predicate has to be enforced in the database query and not in the UI.

*If this boundary were missing:* each component would hand-roll `fetch` and the error shape would differ per screen. Nothing about correctness changes.

## Boundary 3 — the HTTP route handler

`src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts:12-28`. Four lines of real work:

```ts
const { session } = buildRouteContext(request);          // identity, from headers
const { cycleId } = await context.params;                // identity of the cycle, from the URL
const input = submitSelfReviewSchema.parse(await request.json());  // shape, from the body
const submission = await reviewCycleService.submitSelfReview(session, cycleId, input);
return ok(submission);
```

`buildRouteContext` (`src/lib/http/route-context.ts:9-13`) is a one-liner over `requireSession(request)`. The important split is visible right here: **`session` comes from the transport, `input` comes from the body, and they are passed as separate arguments.** The service can therefore never confuse "who is asking" with "what they asked for". `cycleId` sits in between — it is caller-supplied, but it is an identifier, so it is allowed through and verified later by a relation check rather than trusted.

The `catch` hands everything to `handleRouteError` (`src/lib/http/api-response.ts:19-41`), which turns an `AppError` into `{ error: { message, details } }` with its own status and anything else into a generic 500. No Prisma error text ever reaches the client.

*If this boundary were missing:* the route would be the service, and the permission checks would be duplicated per HTTP verb.

## Boundary 4 — the validator

`src/lib/validation/reviewSchemas.ts:9-15`:

```ts
export const submitSelfReviewSchema = z.object({
  strengths: z.string().min(10).max(2000),
  areasToImprove: z.string().min(10).max(2000),
  accomplishments: z.string().min(10).max(2000),
  overallRating: z.coerce.number().int().min(1).max(5),
  answers: z.record(z.string(), z.string().min(1)).default({}),
});
```

`parse` throws on the first violation, so the route's `catch` turns bad input into a 4xx before any service code runs. Three things to notice: the schema is a **strict shape** (an `employeeId` in the body is simply not part of the parsed result, so it cannot be smuggled through); `z.coerce.number()` accepts the string `"4"` a form would send; and every string is bounded at both ends, which is a supportability decision as much as a security one — `max(2000)` is what stops a 40 MB paste from reaching the database.

*If this boundary were missing:* the service would receive `undefined` fields and Prisma would reject them with a driver error, producing a 500 where a 400 belongs.

## Boundary 5 — the service (permissions and state rules)

`src/services/review-service.ts:36-86`. In order: `assertTenantRole(session, [...], "submit self reviews")`, `assertEmployeeContext(session)`, then `toRepositoryContext(session)` to build `{ tenantId, actorUserId }`, then `findSelfReviewContext` to read the assignment, then three rejections — 404 when there is no assignment, 409 when `cycleStatus !== "ACTIVE"`, 409 when the assignment is already `SUBMITTED`.

`subjectEmployeeId` is taken as `session.employeeId as string` (line 49), never from `input`. This is the boundary where "Sam" becomes `emp_sam`.

The three rejections here produce the *good error messages*, and they are **not** the concurrency guarantee. Two requests can both read `IN_PROGRESS` and both pass these checks. Write that sentence down; it is the thing juniors get wrong.

*If this boundary were missing:* a valid-looking request for a closed cycle would reach the repository, where it would be rejected silently by a predicate and come back as a bare 404 with no explanation.

## Boundary 6 — the repository transaction

`src/repositories/review-repository.ts:91-156`. `db.$transaction(async (tx) => { ... })` containing, in order: the conditional `tx.reviewAssignment.updateMany` with **all eight predicates** (tenant, id, cycle, reviewer, subject, `type: "SELF"`, status in `[NOT_STARTED, IN_PROGRESS]`, related cycle `ACTIVE`), `if (claimed.count !== 1) return null;`, `tx.reviewResponse.create`, `tx.auditLog.create`, and finally a small detached `{ id, updatedAt }`.

This is the only boundary that is *authoritative*. Everything above it can be bypassed by another caller, a script, or a second copy of the service. The predicates are deliberately redundant with the service's checks — redundancy between a friendly error and an enforced rule is correct, not waste.

*If this boundary were missing* (it was, before the change): two concurrent submissions both write, a guessed assignment id from another tenant gets a response, and an audit row can exist for a change that never committed.

## Write the table

One row per failure mode. Fill in which boundary rejects it and with what status. Check your answers against `src/tests/` — every row has a test somewhere in `auth-permissions`, `tenant-isolation`, `validation-boundaries`, `review-transition` or `workflow-atomicity`.

| Failure mode | Boundary that rejects it | Status |
|---|---|---|
| `strengths` is 4 characters | | |
| Caller is not an employee of this tenant | | |
| Cycle is `CLOSED` | | |
| Assignment already `SUBMITTED` (sequential second request) | | |
| Assignment already `SUBMITTED` (simultaneous second request) | | |
| Assignment id belongs to another tenant | | |
| Assignment is a MANAGER review, not SELF | | |

## Now trace the queue

Repeat the exercise for the integration worker, which has a different shape because nobody is waiting on the other end of it: `src/app/api/integration-jobs/process/route.ts` → `src/lib/validation/integrationSchemas.ts:19` (`batchSize: z.coerce.number().int().min(1).max(20).default(5)` — find where the bound is enforced) → `IntegrationService.processQueuedJobs` (the permission branch) → `IntegrationRepository.claimQueuedJobs:181-208` (where `claimToken` is introduced) → `processQueuedIntegrationJobs` (the processor) → `completeJob:213-236`.

Then build a deliberately stale completion call: claim a job, keep the token, cause a retry, claim again, and call `completeJob` with the first token. Identify the exact predicate that rejects it. If the stale path still writes a log, the worker has confused *processing* with *ownership*.

Extend this lab only with the existing interfaces. If you need a new durable lease, document the schema change and migration requirement (chapter 3) rather than hiding it in a test fake. A clear limitation is stronger than a fictional production guarantee.
