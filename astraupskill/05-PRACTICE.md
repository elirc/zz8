# 5. Practice exercises

*Time: about 90 minutes for A-C, plus 20 for D. Worked answers are in [chapter 6](06-SOLUTIONS-AND-REVIEW.md) - try each exercise before you open it.*

Exercise A: create two self-review requests for one ACTIVE SELF assignment. Give each a different strengths string. Model the repository update count and response create in a transaction fake. Run both requests concurrently and prove exactly one response and one SUBMITTED transition remain. Add a wrong-subject request and assert no write.

Exercise B: create one QUEUED integration job. Have two worker calls claim with batch size one. Return a unique token for the winner. Complete once with the winner token and once with an old token. Assert one processed result, one attempt, one completion log, and no stale log.

Exercise C: make the audit insert throw after a tentative retry status update. Assert the job remains FAILED and retry audit count is zero. Repeat for self-review. Explain why a service-level `try/catch` cannot undo a committed database update; rollback belongs to the transaction boundary.

Use imports from `@/services/review-service` and `@/jobs/process-queued-integration-jobs`. Keep test inputs at least ten characters for review fields and at least eight for retry reasons so validation is not the accidental failure.

Exercise D (red first): restore the original code and watch the tests fail.

1. Copy `astraupskill/snapshots/review-repository.ts.original.txt` over `src/repositories/review-repository.ts` (keep a copy of the current file first, or rely on git).
2. Run `npm test -- run src/tests/workflow-atomicity.test.ts`.
3. Write down which test names fail and the exact assertion message. Expected: the audit-rollback test and the wrong-subject test fail, because the original `updateMany` filtered only on tenant and id and the original `upsert` would write a response for an assignment that was never claimed.
4. Restore the fixed file and re-run. Expected: `Tests  4 passed (4)`.

Do the same with `snapshots/integration-repository.ts.original.txt` and the claim-token test. A test you have never seen fail is a test you do not yet trust.

Exercise E (harder, optional): the queue has no lease expiry. A worker that crashes leaves a job `RUNNING` forever. Design - do not implement - a recovery path: which column would you add, what query would move abandoned rows to `RETRY_REQUIRED`, how would you avoid reclaiming a job that is merely slow, and what would the migration look like? Write it as a short design note and compare it with the caveat at the end of chapter 3.

Extend the exercises only with the existing interfaces. If you need a new durable lease, first document the schema change and migration requirement rather than hiding it in a test fake. A clear limitation is stronger than a fictional production guarantee.
