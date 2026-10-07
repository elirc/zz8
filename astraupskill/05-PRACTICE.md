# 5. Practice exercises

*Time: about 90 minutes for A-C, plus 20 for D. Worked answers are in [chapter 6](06-SOLUTIONS-AND-REVIEW.md) - try each exercise before you open it.*

**Exercise A.** **Goal:** create two self-review requests for one ACTIVE SELF assignment, each with a different strengths string. Model the repository update count and the response create in a transaction fake, run both requests concurrently, then add a wrong-subject request. **Check:** exactly one response and one SUBMITTED transition remain, and the wrong-subject request writes nothing. The loser surfaces as 404 from `src/services/review-service.ts:84-86`. Compare with `src/tests/workflow-atomicity.test.ts:184` and `:206`.

**Exercise B.** **Goal:** create one QUEUED integration job, have two worker calls claim it with batch size one, return a unique token for the winner, then complete once with the winner token and once with an old token. **Check:** one processed result, one attempt, one completion log, and no stale log (`src/jobs/process-queued-integration-jobs.ts:40-49`). Then go further than `workflow-atomicity.test.ts:223`: drive the **real** `IntegrationRepository.claimQueuedJobs` and `completeJob` through the in-memory Prisma double, so that deleting `status: "QUEUED"` (`src/repositories/integration-repository.ts:188`) or `claimToken` (`:222`) makes your test fail.

**Exercise C.** **Goal:** make the audit insert throw after a tentative retry status update, then repeat for self-review. **Check:** the job remains FAILED and the retry audit count is zero, because `queueRetry` writes the update, log and audit in one `$transaction` (`src/repositories/integration-repository.ts:115-152`). The self-review case matches `workflow-atomicity.test.ts:165`. Explain in one sentence why a service-level `try/catch` cannot undo a committed database update: rollback belongs to the transaction boundary.

Use imports from `@/services/review-service` and `@/jobs/process-queued-integration-jobs`. Keep test inputs at least ten characters for review fields and at least eight for retry reasons so validation is not the accidental failure.

Exercise D (red first): restore the original code and watch the tests fail.

1. Copy `astraupskill/snapshots/review-repository.ts.original.txt` over `src/repositories/review-repository.ts` (keep a copy of the current file first, or rely on git).
2. Run `npm test -- run src/tests/workflow-atomicity.test.ts`.
3. Write down which test names fail and the exact assertion message. Expected: the audit-rollback test and the wrong-subject test fail, because the original `updateMany` filtered only on tenant and id and the original `upsert` would write a response for an assignment that was never claimed.
4. Restore the fixed file and re-run. Expected: `Tests  4 passed (4)`.

Now try the same with `snapshots/integration-repository.ts.original.txt` and the claim-token test. Expected: the claim-token test still **passes**. It drives `processQueuedIntegrationJobs` with a hand-written fake repository (`src/tests/workflow-atomicity.test.ts:228-240`), so it never runs the repository file you just swapped. That is the gap Exercise B asks you to close. A test you have never seen fail is a test you do not yet trust.

Exercise E (harder, optional). **Goal:** the queue has no lease expiry, so a worker that crashes leaves a job `RUNNING` forever (`claimQueuedJobs` selects only `QUEUED`, `src/repositories/integration-repository.ts:162`, and retry accepts only FAILED/RETRY_REQUIRED, `:120`). Design, but do not implement, a recovery path. **Check:** your short design note answers four questions. Which column would you add? What query would move abandoned rows to `RETRY_REQUIRED`? How would you avoid reclaiming a job that is merely slow? What would the migration look like? Compare it with the caveat at the end of chapter 3.

Extend the exercises only with the existing interfaces. If you need a new durable lease, first document the schema change and migration requirement rather than hiding it in a test fake. A clear limitation is stronger than a fictional production guarantee.
