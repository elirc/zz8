# 3. Worked change: two write paths turned into guarded claims

*Time: about 40 minutes. Keep `src/repositories/review-repository.ts` and `src/repositories/integration-repository.ts` open beside this chapter, plus the matching files in `astraupskill/snapshots/`.*

## 3a. The self-review submission

Before the repair, the repository updated an assignment by tenant and ID only, then upserted a response. A foreign or nonexistent assignment could receive a response if an ID was guessed, and two requests could both overwrite the same response. The corrected call includes `reviewCycleId`, reviewer, subject, type SELF, ACTIVE cycle status, and an available assignment status.

The central excerpt is in `src/repositories/review-repository.ts`:

```ts
const claimed = await tx.reviewAssignment.updateMany({
  where: { tenantId: ctx.tenantId, id: input.assignmentId,
    reviewCycleId: input.cycleId, reviewerUserId: input.reviewerUserId,
    subjectEmployeeId: input.subjectEmployeeId, type: "SELF",
    status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
    reviewCycle: { status: "ACTIVE" } },
  data: { status: "SUBMITTED", submittedAt: new Date() },
});
if (claimed.count !== 1) return null;
```

Place the equivalent predicate only in the repository transaction, after the service has derived IDs from the session. Follow it with `reviewResponse.create` and `tx.auditLog.create`. If either write throws, the transaction rolls back. The response returned to the route contains assignment and cycle information, never password or unrelated employee data.

Practice: make a second request with the same assignment and assert the repository’s second conditional update returns zero. Then force the audit create to fail and assert no response remains in the fake transaction state.

### Transaction placement checklist

At the service layer, capture the trusted actor and the original context before constructing the command. At the repository layer, use one transaction client for the compare-and-set update, response create, and audit create. Return a detached result after the transaction callback completes. If the callback throws, let the error propagate to the route mapper; do not catch it, return a partial response, and continue.

The unique constraint on review responses protects against duplicate rows, but it is not a substitute for the assignment predicate. A foreign assignment could still be written if only the response key were checked. Likewise, an existing response does not tell the caller whether the assignment is currently open. Keep the domain error and database constraint working together.

A good code review can identify the exact race window: both requests complete findSelfReviewContext before either updateMany. Only the transaction predicate closes it. Tests should name that window and make it visible, rather than simply calling the method twice after the first call has already committed.

## 3b. The queue claim

The queue repository’s `claimQueuedJobs` method first reads a bounded candidate list, then performs a conditional update for each candidate. The read is an optimization and ordering aid; it is not ownership. The status predicate is the ownership boundary. After a successful update, the method re-reads the row with the generated claim token and returns that metadata to the worker.

The worker in `src/jobs/process-queued-integration-jobs.ts` passes `job.claimToken` into `completeJob`. The completion predicate requires RUNNING and the same token. A matching completion returns the updated row and permits one log. A stale completion returns null and emits no log. This keeps old processors from changing or describing a later retry.

A fake test can model two workers by making the first claim transition QUEUED to RUNNING before the second claim checks status. Assert that the combined processed list has one element, that attempts increment once, and that completion with `stale-token` returns null. Label this as a repository contract test; only a PostgreSQL test can prove behavior across processes and isolation levels.

Do not make batch size unbounded. The schema caps it at 20, and the service receives the parsed integer rather than trusting a query string directly.

### Worker failure handling

A processor can throw before completion, so a production worker needs a policy for leaving RUNNING jobs and recovering leases. The current bounded example uses explicit statuses and claim tokens; it does not invent a timeout or heartbeat. A future lease field could allow a recovery query to move abandoned RUNNING rows to RETRY_REQUIRED, but that change would need its own migration and tests.

The current implementation’s simulateFailure payload is a teaching fixture, not a vendor adapter. It demonstrates that a failed attempt completes with FAILED and an error message. Real processors should keep vendor credentials out of payloadJson, classify retryable versus terminal errors, and cap retries. The repository contract remains the place where tenant, status, and claim identity are enforced.

When a worker completes successfully, it must not reset attemptCount or claimToken before the result is read. The claim token remains useful for audit and debugging until a retry explicitly clears it. Do not return the token to ordinary dashboard consumers.

### The claim code, in full

`src/repositories/integration-repository.ts:181-208` — the loop that turns a candidate list into owned rows:

```ts
const claimed: ClaimedIntegrationJob[] = [];
for (const job of jobs) {
  const claimToken = crypto.randomUUID();
  const result = await db.integrationJob.updateMany({
    where: { tenantId: ctx.tenantId, id: job.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      finishedAt: null,
      claimToken,
      attemptCount: { increment: 1 },
    },
  });
  if (result.count !== 1) continue;
  const current = await db.integrationJob.findFirst({
    where: { tenantId: ctx.tenantId, id: job.id, status: "RUNNING", claimToken },
    /* includes omitted */
  });
  if (current?.claimToken === claimToken) claimed.push(current as ClaimedIntegrationJob);
}
```

And `completeJob` (`integration-repository.ts:213-236`) refuses to write without the same token:

```ts
const updated = await db.integrationJob.updateMany({
  where: { tenantId: ctx.tenantId, id: input.jobId, status: "RUNNING", claimToken: input.claimToken },
  data: { status: input.success ? "SUCCEEDED" : "FAILED", /* ... */ },
});
if (updated.count !== 1) return null;
```

Two honest caveats the code does not state:

- **The re-read is not inside a transaction.** The `updateMany` and the following `findFirst` are two separate statements on `db`, not on a `tx` client. The token check (`current?.claimToken === claimToken`) is what makes this safe in practice: if another attempt overwrote the row between the two statements, the token no longer matches and the job is skipped rather than double-processed. A stricter version would wrap both statements in `db.$transaction`.
- **`attemptCount` changed meaning.** It used to be incremented when an operator retried a job; it is now incremented when a worker wins a claim. Rows that were already in the database were counted under the old rule, so a mixed history is possible. If you adopt this change on a live database, say so in the release note, or backfill.

### The schema change: `claimToken`

`prisma/schema.prisma:368` adds one nullable column and one index:

```prisma
claimToken   String?
@@index([tenantId, claimToken])
```

This project ships **no `prisma/migrations/` directory**, so the change reaches a database through `db push`, which diffs the schema against the live database and applies the difference directly:

```bash
npm run db:generate   # regenerate the typed client; required or `claimToken` will not compile
npm run db:push       # add the column and index to the database in DATABASE_URL
```

What `db push` does here is cheap and safe: `ALTER TABLE "IntegrationJob" ADD COLUMN "claimToken" TEXT;` plus `CREATE INDEX`. It is safe *because the column is nullable* — existing rows get `NULL`, and `completeJob` only matches rows whose token equals the one the worker holds, so an old `RUNNING` row with a `NULL` token can no longer be completed by anyone and must be retried. That is the intended behaviour, but notice that it is a one-way door for jobs that were mid-flight during the deploy.

`db push` is a development tool. In a project with a migrations folder the same change is:

```bash
npx prisma migrate dev --name add_integration_job_claim_token
```

which writes a reviewable `migrations/<timestamp>_add_integration_job_claim_token/migration.sql` containing exactly the two statements above, and `npx prisma migrate deploy` applies it in production. Never run `db push` against a customer database: it has no record of what it did and it will happily drop a column you renamed.

### Three variations to try

Make each change, run the focused test, then undo it.

1. **Delete `subjectEmployeeId` from the `updateMany` where clause** in `review-repository.ts:107`. Run `npm test -- run src/tests/workflow-atomicity.test.ts`. Expected: "writes nothing when the subject employee predicate does not match" fails, because the repository now claims an assignment that belongs to someone else. This is the exact authorisation hole the change closed.
2. **Move `tx.auditLog.create` out of the transaction** — take the `submitSelfReview` return value in the service and write the audit row after `db.$transaction` resolves. Expected: "does not commit a self-review assignment when its audit insert fails" now fails on `assignments[0].status`, because the assignment committed while the audit row did not. The failure message tells you the invariant: no state change without its audit record.
3. **Drop `claimToken: input.claimToken` from `completeJob`'s where clause.** Expected: "completes only the worker holding the immutable claim token" fails at `expect(stale).toBeNull()` — the stale worker is suddenly allowed to mark a job it no longer owns as FAILED.

### Predict, then run, then verify

Predict the number for each row, then run `npm test -- run src/tests/workflow-atomicity.test.ts` and read the assertions.

| Scenario | Rows in `reviewResponse` | Assignment status | Audit rows |
|---|---|---|---|
| One valid submission | 1 | `SUBMITTED` | 1 |
| Two concurrent submissions of the same assignment | 1 | `SUBMITTED` | 1 |
| Audit insert throws | 0 | `IN_PROGRESS` | 0 |
| Wrong `subjectEmployeeId` | 0 | `IN_PROGRESS` | 0 |

Expected observation: `Test Files 1 passed (1) / Tests 4 passed (4)`.
