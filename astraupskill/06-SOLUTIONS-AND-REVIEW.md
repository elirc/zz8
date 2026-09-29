# 6. Solutions and review

Worked answers to the exercises in [chapter 5](05-PRACTICE.md). Every block below is real code from, or a real variation of, `src/tests/workflow-atomicity.test.ts`; you can paste it into a file under `src/tests/` and run it with `npm test -- run src/tests/<your-file>.test.ts`. Read your own attempt first, then the review paragraph under each answer.

## Shared harness

All three answers need a Prisma double. Put this at the top of your test file. Note where the rollback lives: in `$transaction`, never in the method you are testing.

```ts
import { beforeEach, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  current: { cycles: [], assignments: [], responses: [], auditLogs: [] } as Record<string, any[]>,
  auditCreateThrows: false,
  nextId: 1,
}));

vi.mock("@/lib/db", () => {
  const matchLeaf = (actual: unknown, expected: unknown): boolean => {
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const spec = expected as Record<string, unknown>;
      if (Array.isArray(spec.in)) return (spec.in as unknown[]).includes(actual);
      return false;
    }
    return actual === expected;
  };

  const matchAssignment = (row: Record<string, any>, where: Record<string, any>): boolean =>
    Object.entries(where).every(([key, expected]) => {
      if (key === "reviewCycle") {
        const cycle = store.current.cycles.find((c) => c.id === row.reviewCycleId);
        if (!cycle) return false;
        return Object.entries(expected).every(([k, v]) => matchLeaf(cycle[k], v));
      }
      return matchLeaf(row[key], expected);
    });

  const models = {
    reviewAssignment: {
      findFirst: async ({ where }: any) => {
        const row = store.current.assignments.find((c) => matchAssignment(c, where));
        if (!row) return null;
        return {
          ...row,
          reviewCycle: store.current.cycles.find((c) => c.id === row.reviewCycleId),
          response: store.current.responses.find((r) => r.reviewAssignmentId === row.id) ?? null,
        };
      },
      updateMany: async ({ where, data }: any) => {
        const rows = store.current.assignments.filter((c) => matchAssignment(c, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    reviewResponse: {
      create: async ({ data }: any) => {
        const row = { id: `response-${store.nextId++}`, updatedAt: new Date(0), ...data };
        store.current.responses.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        if (store.auditCreateThrows) throw new Error("audit insert failed");
        const row = { id: `audit-${store.nextId++}`, ...data };
        store.current.auditLogs.push(row);
        return row;
      },
    },
  };

  const client = {
    ...models,
    $transaction: async <T>(callback: (tx: typeof models) => Promise<T>): Promise<T> => {
      const snapshot = JSON.stringify(store.current);
      try {
        return await callback(models);
      } catch (error) {
        store.current = JSON.parse(snapshot);
        throw error;
      }
    },
  };

  return { db: client };
});

const { ReviewRepository } = await import("@/repositories/review-repository");
const { ReviewService } = await import("@/services/review-service");

const context = { tenantId: "tenant_northstar", actorUserId: "user_employee" };
const session = {
  userId: "user_employee",
  activeTenantId: context.tenantId,
  platformRole: "NONE" as const,
  tenantRole: "EMPLOYEE" as const,
  employeeId: "emp_sam",
  displayName: "Sam Employee",
};
const input = {
  strengths: "I documented the workflow boundaries clearly.",
  areasToImprove: "I will add more failure-path examples.",
  accomplishments: "I delivered the tenant-safe review flow.",
  overallRating: 4,
  answers: { q1: "The assignment was clear." },
};

beforeEach(() => {
  store.current = {
    cycles: [{ id: "cycle-1", tenantId: context.tenantId, name: "Midyear", status: "ACTIVE" }],
    assignments: [{
      id: "assignment-1", tenantId: context.tenantId, reviewCycleId: "cycle-1",
      reviewerUserId: session.userId, subjectEmployeeId: session.employeeId,
      type: "SELF", status: "IN_PROGRESS", submittedAt: null,
    }],
    responses: [],
    auditLogs: [],
  };
  store.auditCreateThrows = false;
  store.nextId = 1;
});
```

**Why `vi.hoisted` and the dynamic imports:** `vi.mock` is hoisted above every `import` in the file, so a plain `const store = {...}` would still be in the temporal dead zone when the factory runs. `vi.hoisted` moves the store up with it. For the same reason the modules under test are pulled in with `await import(...)` *after* the mock is registered — a static `import { ReviewRepository }` would be evaluated before the mock exists and would get the real Prisma client.

## Exercise A — two concurrent submissions, and a wrong subject

```ts
it("lets exactly one of two concurrent submissions claim the assignment", async () => {
  const repository = new ReviewRepository();
  const command = {
    assignmentId: "assignment-1",
    cycleId: "cycle-1",
    reviewerUserId: session.userId,
    subjectEmployeeId: session.employeeId,
    ...input,
  };

  const [first, second] = await Promise.all([
    repository.submitSelfReview(context, command),
    repository.submitSelfReview(context, command),
  ]);

  expect([first, second].filter((r) => r !== null)).toHaveLength(1);
  expect(store.current.assignments[0].status).toBe("SUBMITTED");
  expect(store.current.responses).toHaveLength(1);
  expect(store.current.auditLogs).toHaveLength(1);
});

it("writes nothing when the subject employee predicate does not match", async () => {
  const repository = new ReviewRepository();

  const result = await repository.submitSelfReview(context, {
    assignmentId: "assignment-1",
    cycleId: "cycle-1",
    reviewerUserId: session.userId,
    subjectEmployeeId: "emp_someone_else",
    ...input,
  });

  expect(result).toBeNull();
  expect(store.current.assignments[0].status).toBe("IN_PROGRESS");
  expect(store.current.responses).toHaveLength(0);
});
```

**Review.** The interesting assertion is not `toHaveLength(1)` on the winners — it is `responses` having exactly one row. A weaker implementation (the original `upsert`) would produce one response *and* let the loser overwrite its text, so the row count would still be 1 while the content silently changed; that is why the exercise asks for two different `strengths` strings. Add `expect(store.current.responses[0].strengths).toBe(firstStrengths)` if you want to pin that down. The second test is the authorisation half: it fails the moment somebody deletes a predicate from the `where` clause, which is exactly the regression the change was made to prevent. Note that both callers here are promises in one process; this proves the predicate is present and correct, not that PostgreSQL serialises them (see the limits in chapter 8).

## Exercise B — claim token, one winner, no stale log

```ts
it("completes only the worker holding the immutable claim token", async () => {
  const { processQueuedIntegrationJobs } = await import("@/jobs/process-queued-integration-jobs");
  let status: "QUEUED" | "RUNNING" | "SUCCEEDED" = "QUEUED";
  let claimToken = "";
  let logCount = 0;
  const job = { id: "job-1", payloadJson: {}, claimToken: "" };
  const repository = {
    claimQueuedJobs: async () => {
      if (status !== "QUEUED") return [];          // the QUEUED predicate, in miniature
      status = "RUNNING";
      claimToken = `claim-${crypto.randomUUID()}`; // a fresh token per winning claim
      return [{ ...job, claimToken }];
    },
    completeJob: async (_ctx: typeof context, value: { jobId: string; claimToken: string; success: boolean }) => {
      if (status !== "RUNNING" || value.claimToken !== claimToken) return null;
      status = value.success ? "SUCCEEDED" : "QUEUED";
      return { ...job, status, claimToken };
    },
    addLog: async () => { logCount += 1; },
  };
  const deps = { integrationRepository: repository } as never;

  const [first, second] = await Promise.all([
    processQueuedIntegrationJobs({ ctx: context, batchSize: 1 }, deps),
    processQueuedIntegrationJobs({ ctx: context, batchSize: 1 }, deps),
  ]);

  expect(first.length + second.length).toBe(1);
  expect(status).toBe("SUCCEEDED");
  expect(await repository.completeJob(context, { jobId: "job-1", claimToken: "stale", success: false })).toBeNull();
  expect(logCount).toBe(1);
});
```

**Review.** Here the code under test is `processQueuedIntegrationJobs` (`src/jobs/process-queued-integration-jobs.ts`), not the repository, so the fake is allowed to be a hand-written state machine — it stands in for the database, and the assertion is about what the *worker* does with a `null` return. `expect(logCount).toBe(1)` is the whole point of the change: before it, `addLog` was called outside the success branch, so a stale worker wrote a log line describing a job somebody else owned. If you want to see it fail, move `addLog` above the completion guard in the worker and re-run. Do **not** try to prove the repository's claim predicate with this fake — for that you need the `updateMany`-shaped double from Exercise A, pointed at `IntegrationRepository`.

## Exercise C — the audit insert throws

```ts
it("does not commit a self-review assignment when its audit insert fails", async () => {
  const service = new ReviewService({
    reviewRepository: new ReviewRepository(),
    auditLogRepository: { create: async () => undefined },
  });
  store.auditCreateThrows = true;

  await expect(service.submitSelfReview(session, "cycle-1", input)).rejects.toThrow("audit insert failed");

  expect(store.current.assignments[0].status).toBe("IN_PROGRESS");
  expect(store.current.assignments[0].submittedAt).toBeNull();
  expect(store.current.responses).toHaveLength(0);
  expect(store.current.auditLogs).toHaveLength(0);
});
```

**Review.** Four assertions, because a rollback that only restores one of three tables is not a rollback. The reason a service-level `try/catch` cannot replace this: by the time the service sees the exception, `updateMany` has already been sent to the database and, outside a transaction, already committed. A compensating update ("set it back to IN_PROGRESS") is a second write that can itself fail, can race with a legitimate third request, and leaves a window in which readers see `SUBMITTED` with no response. The transaction boundary is the only place where "all three or none" is a single decision. Also notice what is *not* asserted: that the promise rejected. That alone would pass even if every row had committed.

## Exercise D — red first

Expected failures after restoring `snapshots/review-repository.ts.original.txt`:

- `writes nothing when the subject employee predicate does not match` — the call returns a response object instead of `null`, because the original `where` clause was `{ tenantId, id }` only.
- `does not commit a self-review assignment when its audit insert fails` — fails on `assignments[0].status`: the original wrote the audit row from the *service* after the repository returned, so the assignment transition had already committed when the audit write blew up.

Restore the fixed file and confirm `Tests  4 passed (4)`. If a test passes against the original code, it is not testing the change.

## Exercise E — lease recovery design (sketch answer)

Add `claimExpiresAt DateTime?` next to `claimToken`, set it to `now() + interval` on a winning claim, and add a recovery query:

```ts
await db.integrationJob.updateMany({
  where: { tenantId, status: "RUNNING", claimExpiresAt: { lt: new Date() } },
  data: { status: "RETRY_REQUIRED", claimToken: null, errorMessage: "Lease expired." },
});
```

Clearing `claimToken` is what makes it safe: a slow-but-alive worker that finally calls `completeJob` presents a token that no longer matches any row, gets `null`, and logs nothing — the same protection the change already gives against retries. The worker must also renew its lease periodically, or a long job will be reclaimed while it is still running; that heartbeat, not the expiry, is the hard part. The migration is one nullable column and one index (`@@index([tenantId, status, claimExpiresAt])`), written as `npx prisma migrate dev --name add_integration_job_claim_expiry` rather than `db push` — see chapter 3.
