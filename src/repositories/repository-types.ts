/**
 * What this file does: declares the repository return shapes that services, hooks, and tests share.
 * What calls it: repository implementations, services, and in-memory test doubles.
 * What it calls: shared domain status types from src/lib/domain.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: leaking raw ORM payloads everywhere until every caller depends on incidental include shapes.
 */
import type {
  EmploymentStatus,
  IntegrationDirection,
  IntegrationJobStatus,
  IntegrationType,
  ReviewAssignmentStatus,
  ReviewCycleStatus,
} from "@/lib/domain";

export interface EmployeeRecord {
  id: string;
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
  manager: { id: string; firstName: string; lastName: string } | null;
  orgUnit: { id: string; name: string; code: string } | null;
}

export interface ReviewCycleOverview {
  id: string;
  name: string;
  description: string | null;
  status: ReviewCycleStatus;
  startDate: Date;
  endDate: Date;
  counts: {
    goals: number;
    reviewAssignments: number;
    feedbackRequests: number;
  };
}

export interface SelfReviewContextRecord {
  assignmentId: string;
  assignmentStatus: ReviewAssignmentStatus;
  cycleId: string;
  cycleName: string;
  cycleStatus: ReviewCycleStatus;
  reviewerUserId: string;
  subjectEmployeeId: string;
  responseId: string | null;
}

export interface IntegrationConfigRecord {
  id: string;
  name: string;
  integrationType: IntegrationType;
  direction: IntegrationDirection;
  scheduleCron: string;
  isActive: boolean;
  lastSuccessfulSyncAt: Date | null;
}

export interface IntegrationJobRecord {
  id: string;
  status: IntegrationJobStatus;
  errorMessage: string | null;
  retryReason: string | null;
  attemptCount: number;
  payloadJson: unknown;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  integrationConfig: {
    id: string;
    name: string;
    integrationType: IntegrationType;
  };
  requestedByUser: {
    id: string;
    displayName: string;
  };
  logs: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: Date;
  }>;
}

export interface ClaimedIntegrationJob extends IntegrationJobRecord {
  claimToken: string;
}
