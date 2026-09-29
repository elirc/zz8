/**
 * What this file does: implements tenant-scoped integration config, job, and log persistence for the existing service layer.
 * What calls it: src/services/integration-service.ts through src/services/service-factory.ts.
 * What it calls: Prisma client in src/lib/db.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: thinking support tooling is exempt from tenant scoping because only admins use it.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

import type { RepositoryContext } from "@/repositories/repository-context";
import type {
  ClaimedIntegrationJob,
  IntegrationConfigRecord,
  IntegrationJobRecord,
} from "@/repositories/repository-types";

export class IntegrationRepository {
  async listConfigs(ctx: RepositoryContext): Promise<IntegrationConfigRecord[]> {
    return db.integrationConfig.findMany({
      where: {
        tenantId: ctx.tenantId,
      },
      orderBy: { name: "asc" },
    });
  }

  async findConfigById(ctx: RepositoryContext, integrationConfigId: string) {
    return db.integrationConfig.findFirst({
      where: {
        tenantId: ctx.tenantId,
        id: integrationConfigId,
      },
    });
  }

  async listJobs(ctx: RepositoryContext): Promise<IntegrationJobRecord[]> {
    return db.integrationJob.findMany({
      where: {
        tenantId: ctx.tenantId,
      },
      include: {
        integrationConfig: {
          select: { id: true, name: true, integrationType: true },
        },
        requestedByUser: {
          select: { id: true, displayName: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, level: true, message: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async createJob(
    ctx: RepositoryContext,
    input: {
      integrationConfigId: string;
      payloadJson: unknown;
      requestedByUserId: string;
    },
  ) {
    return db.integrationJob.create({
      data: {
        tenantId: ctx.tenantId,
        integrationConfigId: input.integrationConfigId,
        requestedByUserId: input.requestedByUserId,
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
        status: "QUEUED",
      },
      include: {
        integrationConfig: {
          select: { id: true, name: true, integrationType: true },
        },
        requestedByUser: {
          select: { id: true, displayName: true },
        },
        logs: {
          select: { id: true, level: true, message: true, createdAt: true },
        },
      },
    });
  }

  async findJobById(ctx: RepositoryContext, jobId: string) {
    return db.integrationJob.findFirst({
      where: {
        tenantId: ctx.tenantId,
        id: jobId,
      },
      include: {
        integrationConfig: {
          select: { id: true, name: true, integrationType: true },
        },
        requestedByUser: {
          select: { id: true, displayName: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, level: true, message: true, createdAt: true },
        },
      },
    });
  }

  async queueRetry(
    ctx: RepositoryContext,
    input: { jobId: string; reason: string },
  ) {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.integrationJob.updateMany({
        where: {
          tenantId: ctx.tenantId,
          id: input.jobId,
          status: { in: ["FAILED", "RETRY_REQUIRED"] },
        },
        data: {
          status: "QUEUED",
          retryReason: input.reason,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          claimToken: null,
        },
      });
      if (result.count !== 1) return false;
      await tx.integrationLog.create({
        data: {
          tenantId: ctx.tenantId,
          integrationJobId: input.jobId,
          level: "INFO",
          message: "Job manually queued for retry.",
          detailsJson: { reason: input.reason },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.actorUserId,
          action: "INTEGRATION_JOB_RETRIED",
          entityType: "integrationJob",
          entityId: input.jobId,
          metadataJson: { reason: input.reason },
        },
      });
      return true;
    });
    if (!updated) return null;

    return this.findJobById(ctx, input.jobId);
  }

  async claimQueuedJobs(ctx: RepositoryContext, batchSize: number): Promise<ClaimedIntegrationJob[]> {
    const jobs = await db.integrationJob.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "QUEUED",
      },
      include: {
        integrationConfig: {
          select: { id: true, name: true, integrationType: true },
        },
        requestedByUser: {
          select: { id: true, displayName: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, level: true, message: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });

    const claimed: ClaimedIntegrationJob[] = [];
    for (const job of jobs) {
      const claimToken = crypto.randomUUID();
      const result = await db.integrationJob.updateMany({
        where: {
          tenantId: ctx.tenantId,
          id: job.id,
          status: "QUEUED",
        },
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
        include: {
          integrationConfig: { select: { id: true, name: true, integrationType: true } },
          requestedByUser: { select: { id: true, displayName: true } },
          logs: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, level: true, message: true, createdAt: true } },
        },
      });
      if (current?.claimToken === claimToken) claimed.push(current as ClaimedIntegrationJob);
    }

    return claimed;
  }

  async completeJob(
    ctx: RepositoryContext,
    input: { jobId: string; claimToken: string; success: boolean; errorMessage?: string | null },
  ) {
    const updated = await db.integrationJob.updateMany({
      where: {
        tenantId: ctx.tenantId,
        id: input.jobId,
        status: "RUNNING",
        claimToken: input.claimToken,
      },
      data: {
        status: input.success ? "SUCCEEDED" : "FAILED",
        errorMessage: input.success ? null : (input.errorMessage ?? "Integration failed."),
        finishedAt: new Date(),
      },
    });

    if (updated.count !== 1) return null;
    return this.findJobById(ctx, input.jobId);
  }

  async addLog(
    ctx: RepositoryContext,
    input: {
      jobId: string;
      level: string;
      message: string;
      detailsJson?: unknown;
    },
  ) {
    await db.integrationLog.create({
      data: {
        tenantId: ctx.tenantId,
        integrationJobId: input.jobId,
        level: input.level,
        message: input.message,
        detailsJson: input.detailsJson as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
