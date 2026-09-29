/**
 * What this file does: enforces review workflow rules for listing cycles and submitting self-reviews.
 * What calls it: review route handlers under src/app/api/review-cycles/.
 * What it calls: auth guards, repository context helpers, review repository, and audit-log repository.
 * One thing a junior engineer would likely get wrong when writing something similar: checking that a review exists but not that the current user is the correct reviewer and subject for that assignment.
 */
import type { AppSession } from "@/lib/domain";
import { assertEmployeeContext, assertTenantRole } from "@/lib/auth/permissions";
import { AppError } from "@/lib/http/app-error";
import type { SubmitSelfReviewInput } from "@/lib/validation/reviewSchemas";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { ReviewRepository } from "@/repositories/review-repository";
import { toRepositoryContext } from "@/repositories/repository-context";

export interface ReviewServiceDeps {
  reviewRepository: Pick<
    ReviewRepository,
    "listCycles" | "findSelfReviewContext" | "submitSelfReview"
  >;
  auditLogRepository: Pick<AuditLogRepository, "create">;
}

export class ReviewService {
  constructor(private readonly deps: ReviewServiceDeps) {}

  async listCycles(session: AppSession) {
    assertTenantRole(
      session,
      ["TENANT_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
      "view review cycles",
    );

    return this.deps.reviewRepository.listCycles(toRepositoryContext(session));
  }

  async submitSelfReview(
    session: AppSession,
    cycleId: string,
    input: SubmitSelfReviewInput,
  ) {
    assertTenantRole(
      session,
      ["TENANT_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
      "submit self reviews",
    );
    assertEmployeeContext(session);

    const ctx = toRepositoryContext(session);
    const subjectEmployeeId = session.employeeId as string;
    const reviewContext = await this.deps.reviewRepository.findSelfReviewContext(ctx, {
      cycleId,
      reviewerUserId: session.userId,
      subjectEmployeeId,
    });

    if (!reviewContext) {
      throw new AppError(404, "Self-review assignment not found.");
    }

    if (reviewContext.cycleStatus !== "ACTIVE") {
      throw new AppError(
        409,
        `Self-review submissions are only allowed while the cycle is ACTIVE. Current status: ${reviewContext.cycleStatus}.`,
      );
    }

    // ⚠️ SENIOR NOTE: state-transition checks belong here in the service, not only in the UI, because multiple clients and scripts may hit the same route.
    if (reviewContext.assignmentStatus === "SUBMITTED") {
      throw new AppError(409, "This self-review has already been submitted.");
    }

    const response = await this.deps.reviewRepository.submitSelfReview(ctx, {
      assignmentId: reviewContext.assignmentId,
      cycleId: reviewContext.cycleId,
      reviewerUserId: session.userId,
      subjectEmployeeId,
      strengths: input.strengths,
      areasToImprove: input.areasToImprove,
      accomplishments: input.accomplishments,
      overallRating: input.overallRating,
      answers: input.answers,
    });

    if (!response) {
      throw new AppError(404, "Review assignment was not found for submission.");
    }

    return {
      assignmentId: reviewContext.assignmentId,
      cycleName: reviewContext.cycleName,
      submittedAt: response.updatedAt,
    };
  }
}
