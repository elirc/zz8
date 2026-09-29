/**
 * What this file does: defines the repository contracts and DTOs shared between services and persistence implementations.
 * What calls it: repository implementations in src/repositories/ and service files in src/services/.
 * What it calls: shared domain types in src/lib/domain.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: passing raw Prisma results everywhere and coupling the service layer to database shapes.
 */
import type {
  AuditAction,
  EmploymentStatus,
  IntegrationJobStatus,
  IntegrationType,
  ReviewAssignmentStatus,
  ReviewCycleStatus,
} from "@/lib/domain";

export interface EmployeeRecord {
  id: string;
  tenantId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  title: string;
  status: EmploymentStatus;
  compensationCents: number;
  currency: string;
  startDate: Date;
  managerId: string | null;
  managerName: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
}

export interface ReviewCycleRecord {
  id: string;
  name: string;
  status: ReviewCycleStatus;
  startDate: Date;
  endDate: Date;
  selfAssignmentStatus: ReviewAssignmentStatus | null;
  goalCount: number;
}

export interface SelfReviewAssignmentRecord {
  assignmentId: string;
  tenantId: string;
  reviewCycleId: string;
  cycleStatus: ReviewCycleStatus;
  subjectEmployeeId: string;
  reviewerUserId: string;
  assignmentStatus: ReviewAssignmentStatus;
  responseId?: string;
}

export interface IntegrationJobRecord {
  id: string;
  tenantId: string;
  integrationConfigId: string;
  integrationName: string;
  integrationType: IntegrationType;
  status: IntegrationJobStatus;
  attemptCount: number;
  errorMessage: string | null;
  retryReason: string | null;
  requestedByName: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface AuditLogInput {
  tenantId: string;
  actorUserId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface EmployeeRepository {
  listByTenant(tenantId: string): Promise<EmployeeRecord[]>;
  create(
    tenantId: string,
    input: {
      employeeNumber: string;
      firstName: string;
      lastName: string;
      workEmail: string;
      title: string;
      employmentType: string;
      status: EmploymentStatus;
      compensationCents: number;
      currency: string;
      startDate: Date;
      managerId?: string;
      orgUnitId?: string;
    },
  ): Promise<EmployeeRecord>;
  update(
    tenantId: string,
    employeeId: string,
    input: Partial<{
      title: string;
      status: EmploymentStatus;
      compensationCents: number;
      managerId?: string;
      orgUnitId?: string;
    }>,
  ): Promise<EmployeeRecord>;
}

export interface ReviewCycleRepository {
  listByTenantForActor(
    tenantId: string,
    actor: { userId: string; employeeId?: string },
  ): Promise<ReviewCycleRecord[]>;
  findSelfAssignment(
    tenantId: string,
    reviewCycleId: string,
    employeeId: string,
    reviewerUserId: string,
  ): Promise<SelfReviewAssignmentRecord | null>;
  submitSelfReview(
    tenantId: string,
    assignmentId: string,
    input: {
      strengths: string;
      areasToImprove: string;
      accomplishments: string;
      overallRating: number;
      answers: Record<string, string>;
    },
  ): Promise<SelfReviewAssignmentRecord>;
}

export interface IntegrationRepository {
  listJobsByTenant(tenantId: string): Promise<IntegrationJobRecord[]>;
  findJobById(tenantId: string, jobId: string): Promise<IntegrationJobRecord | null>;
  queueRetry(tenantId: string, jobId: string, reason: string): Promise<IntegrationJobRecord>;
  listQueuedJobs(tenantId: string, batchSize: number): Promise<IntegrationJobRecord[]>;
  markRunning(tenantId: string, jobId: string): Promise<void>;
  markProcessed(
    tenantId: string,
    jobId: string,
    result: { success: boolean; message: string },
  ): Promise<IntegrationJobRecord>;
}

export interface AuditLogRepository {
  create(input: AuditLogInput): Promise<void>;
}
