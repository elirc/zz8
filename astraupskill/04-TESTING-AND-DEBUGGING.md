# 4. Testing and debugging

*Time: about 30 minutes.*

The tests under `src/tests` are intentionally small but target the actual service entry points. `review-transition.test.ts` calls `ReviewService.submitSelfReview`; `workflow-atomicity.test.ts` calls both `ReviewService` and `processQueuedIntegrationJobs`. The fake repositories expose the same methods as the production contracts, so a renamed claim field fails typecheck rather than silently disappearing.

Reset mutable fake state between tests. Compare detached snapshots before and after a failed transaction. Do not assert only that a promise rejected: an audit failure test must also assert assignment status, response existence, and audit count. For a claim race, assert a positive winner count; an empty result could mean the fixture was never queued.

Run one file with `npm test -- run src/tests/workflow-atomicity.test.ts` from the project root; that works the same on Windows, macOS and Linux because npm resolves the local vitest binary for you. (The archived delivery records used a Windows-only `node_modules\.bin\vitest.cmd` invocation and the old VERIFICATION chapter printed a `vitest.mjs` path that does not exist - do not copy either.) Run `npx tsc --noEmit` after changing Prisma fields or repository contracts. A successful typecheck proves static compatibility, not runtime database availability.

When debugging a zero-row update, log the tenant, ID, expected status, and claim token hash or opaque token identifier, never credentials or full payload secrets. Treat zero as a conflict/loser result, not as permission to retry blindly.
## Test review questions

Ask whether a test reaches the method the application uses. A direct test of a copied reducer cannot prove a repository predicate. The workflow test calls the real worker function and the real review service, while a fake implements their repository interfaces. This catches wrong argument names and verifies that a null completion suppresses the stale log.

Ask whether failure state is independently observed. A rollback test should retain a snapshot taken before the transaction, force an audit failure, then compare the committed store with that snapshot. Do not reset the store inside the assertion path and call that rollback. For a race, have two callers share a store whose conditional update can only return one positive count; assert one winner and one loser.

Ask whether the test has a positive fixture. An every assertion over an empty array passes vacuously. Seed one valid assignment and one queued job, then assert response ID, submitted status, claim token, attempt count, and audit count. Include a foreign tenant fixture so a matching global ID cannot bypass the tenant predicate.

Finally, separate static and runtime evidence. Typecheck catches contract drift. Vitest catches deterministic service behavior. A disposable PostgreSQL run is needed for isolation, transaction rollback under connection failure, and independent worker processes.

When mocking persistent modules, reset implementations as well as call history. A mock that retains the previous test's audit failure can make a happy path fail for the wrong reason. Prefer dependency injection at the service boundary and explicit in-memory state at the repository boundary. Assert that error responses contain a stable status and safe message, not a database stack or request payload.

For validation, use values that reach the intended branch. A retry reason shorter than the schema minimum tests parsing, not queue concurrency. A review answer with an empty string tests validation, not response creation. Keep one edge test per concern and one combined test for the complete path. This makes a later failure actionable and keeps the evidence count honest.
## Failure classification

A 400 response means the request shape or finite bound is invalid. A 403 means the authenticated actor lacks the capability. A 404 means a tenant-scoped entity was not found. A 409 means the entity exists but its state changed or the requested transition is not currently allowed. A 500 is reserved for unexpected infrastructure failure. This mapping helps the caller decide whether to correct input, request access, refresh state, or retry later.

The repository should not turn a zero conditional update into a success object. A truthy stale object can make a worker emit a completion log for a job it never owned. Likewise, the review service should not create an audit event when response creation was skipped. Side effects must follow the positive result of the guarded write.

## The atomicity harness, line by line

`src/tests/workflow-atomicity.test.ts` is worth reading before you write your own test, because it shows how to test a transaction without a database and without cheating.

The module mock replaces `@/lib/db` with an object holding four arrays and three Prisma-shaped models:

```ts
const store = vi.hoisted(() => ({
  current: { cycles: [], assignments: [], responses: [], auditLogs: [] },
  auditCreateThrows: false,
  nextId: 1,
}));

vi.mock("@/lib/db", () => {
  /* models: reviewAssignment.findFirst / updateMany, reviewResponse.create, auditLog.create */
  const client = {
    ...models,
    $transaction: async <T>(callback: (tx: typeof models) => Promise<T>): Promise<T> => {
      const snapshot = JSON.stringify(store.current);
      try {
        return await callback(models);
      } catch (error) {
        store.current = JSON.parse(snapshot) as typeof store.current;
        throw error;
      }
    },
  };
  return { db: client };
});
```

Three details make this a real test rather than a tautology:

1. **`vi.hoisted`** runs before the mock factory, which itself runs before the imports. Without it, `store` would still be undefined when `vi.mock`'s factory closes over it. The same reason forces the dynamic `await import("@/repositories/review-repository")` lines below the mock.
2. **The rollback lives in `$transaction`, not in the code under test.** The snapshot is taken when the transaction opens and restored when the callback throws — exactly what PostgreSQL does. The repository contributes nothing to the rollback except the decision to put all three writes inside the callback. If you moved `auditLog.create` outside `db.$transaction`, the snapshot would already contain the committed assignment change and the test would fail. That is the discriminator: the assertion can only pass if `review-repository.ts` groups its writes.
3. **The models are dumb.** `updateMany` filters with a generic matcher (`tenantId`, `id`, `status: { in: [...] }`, the nested `reviewCycle: { status }` relation) and assigns `data`. It has no knowledge of self-reviews. So when the concurrency test asserts one winner, the "only one row qualifies" behaviour comes from the predicate the repository sent, not from anything the fake decided.

The counter-example is the version this test replaced: its fake `submitSelfReview` snapshotted the state, threw, and restored the state in its own `catch`. That assertion passed no matter what `review-repository.ts` did — it proved the fake worked. If your fake contains the word you are trying to assert (`catch`, `rollback`, `revert`), stop and move that behaviour into the transaction helper.

### What this harness still cannot prove

It cannot prove PostgreSQL isolation levels, row locking, deadlock behaviour, crash recovery, or that two *operating-system processes* interleave the way two promises do. `Promise.all` in Node is cooperative: the first call runs to its first `await` before the second starts. A real proof needs a disposable database, two connections, and assertions on committed rows — see chapter 8.
