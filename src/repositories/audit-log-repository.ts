/**
 * What this file does: persists audit log entries for sensitive tenant actions.
 * What calls it: service-layer modules after successful state-changing operations.
 * What it calls: Prisma client in src/lib/db.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: logging too little context to investigate incidents, or worse, logging cross-tenant data without a tenant filter.
 */
import type { AuditAction } from "@/lib/domain";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

import type { RepositoryContext } from "@/repositories/repository-context";

export interface CreateAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadataJson?: unknown;
}

export class AuditLogRepository {
  async create(ctx: RepositoryContext, input: CreateAuditLogInput) {
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId, // Tenant ownership is explicit here so audit trails cannot drift across organizations.
        actorUserId: ctx.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
