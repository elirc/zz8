import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests exercise the real ReviewRepository against a dumb in-memory Prisma
 * double. The double never rolls anything back by itself: rollback is performed by
 * its `$transaction` helper, which snapshots the tables before the callback runs and
 * restores them if the callback throws. That is the contract PostgreSQL gives us, so
 * a passing assertion here is about `src/repositories/review-repository.ts` grouping
 * its three writes inside one transaction, not about the fake's own `catch`.
 */

type Assignment = {
  id: string;
  tenantId: string;
  reviewCycleId: string;
  reviewerUserId: string;
  subjectEmployeeId: string;
  type: "SELF" | "MANAGER" | "PEER";
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  submittedAt: string | Date | null;
};

type Tables = {
  cycles: Array<{ id: string; tenantId: string; name: string; status: string }>;
  assignments: Assignment[];
  responses: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
};

const store = vi.hoisted(() => ({
  current: {
    cycles: [] as Array<Record<string, unknown>>,
    assignments: [] as Array<Record<string, unknown>>,
    responses: [] as Array<Record<string, unknown>>,
    auditLogs: [] as Array<Record<string, unknown>>,
  },
  auditCreateThrows: false,
  nextId: 1,
}));

vi.mock("@/lib/db", () => {
  type Where = Record<string, unknown>;

  const matchLeaf = (actual: unknown, expected: unknown): boolean => {
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const spec = expected as Record<string, unknown>;
      if (Array.isArray(spec.in)) return (spec.in as unknown[]).includes(actual);
      return false;
    }
    return actual === expected;
  };

  const matchAssignment = (row: Record<string, unknown>, where: Where): boolean =>
    Object.entries(where).every(([key, expected]) => {
      if (key === "reviewCycle") {
        const cycle = store.current.cycles.find((candidate) => candidate.id === row.reviewCycleId);
        if (!cycle) return false;
        return Object.entries(expected as Where).every(([cycleKey, cycleExpected]) =>
          matchLeaf(cycle[cycleKey], cycleExpected),
        );
      }
      return matchLeaf(row[key], expected);
    });

  const models = {
    reviewAssignment: {
      findFirst: async ({ where }: { where: Where }) => {
        const row = store.current.assignments.find((candidate) => matchAssignment(candidate, where));
        if (!row) return null;
        const reviewCycle = store.current.cycles.find((candidate) => candidate.id === row.reviewCycleId);
        const response = store.current.responses.find(
          (candidate) => candidate.reviewAssignmentId === row.id,
        );
        return { ...row, reviewCycle, response: response ?? null };
      },
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const rows = store.current.assignments.filter((candidate) => matchAssignment(candidate, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    reviewResponse: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `response-${store.nextId++}`, updatedAt: new Date(0), ...data };
        store.current.responses.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
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
        store.current = JSON.parse(snapshot) as typeof store.current;
        throw error;
      }
    },
  };

  return { db: client };
});

const { ReviewRepository } = await import("@/repositories/review-repository");
const { ReviewService } = await import("@/services/review-service");
const { processQueuedIntegrationJobs } = await import("@/jobs/process-queued-integration-jobs");

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

function seed() {
  store.current = {
    cycles: [{ id: "cycle-1", tenantId: context.tenantId, name: "Midyear", status: "ACTIVE" }],
    assignments: [
      {
        id: "assignment-1",
        tenantId: context.tenantId,
        reviewCycleId: "cycle-1",
        reviewerUserId: session.userId,
        subjectEmployeeId: session.employeeId,
        type: "SELF",
        status: "IN_PROGRESS",
        submittedAt: null,
      },
    ],
    responses: [],
    auditLogs: [],
  };
  store.auditCreateThrows = false;
  store.nextId = 1;
}

const tables = () => store.current as unknown as Tables;

describe("transaction-shaped workflow contracts", () => {
  beforeEach(() => {
    seed();
  });

  it("does not commit a self-review assignment when its audit insert fails", async () => {
    const service = new ReviewService({
      reviewRepository: new ReviewRepository(),
      auditLogRepository: { create: async () => undefined },
    });
    store.auditCreateThrows = true;

    await expect(service.submitSelfReview(session, "cycle-1", input)).rejects.toThrow(
      "audit insert failed",
    );

    // All three writes live inside one $transaction, so the rollback performed by the
    // transaction helper also discards the assignment transition and the response row.
    expect(tables().assignments[0].status).toBe("IN_PROGRESS");
    expect(tables().assignments[0].submittedAt).toBeNull();
    expect(tables().responses).toHaveLength(0);
    expect(tables().auditLogs).toHaveLength(0);
  });

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

    const winners = [first, second].filter((result) => result !== null);
    expect(winners).toHaveLength(1);
    expect(tables().assignments[0].status).toBe("SUBMITTED");
    expect(tables().responses).toHaveLength(1);
    expect(tables().auditLogs).toHaveLength(1);
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
    expect(tables().assignments[0].status).toBe("IN_PROGRESS");
    expect(tables().responses).toHaveLength(0);
    expect(tables().auditLogs).toHaveLength(0);
  });

  it("completes only the worker holding the immutable claim token", async () => {
    let status: "QUEUED" | "RUNNING" | "SUCCEEDED" = "QUEUED";
    let claimToken = "";
    let logCount = 0;
    const job = { id: "job-1", payloadJson: {}, claimToken: "" };
    const repository = {
      claimQueuedJobs: async () => {
        if (status !== "QUEUED") return [];
        status = "RUNNING";
        claimToken = `claim-${crypto.randomUUID()}`;
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
    const stale = await repository.completeJob(context, { jobId: "job-1", claimToken: "stale", success: false });
    expect(stale).toBeNull();
    expect(logCount).toBe(1);
  });
});
