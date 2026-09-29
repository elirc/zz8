/**
 * What this file does: verifies that self-review submission rejects an invalid cycle-status transition.
 * What calls it: Vitest.
 * What it calls: ReviewService with fake repository dependencies.
 * One thing a junior engineer would likely get wrong when writing something similar: testing only the happy path and never pinning the rejected transition that protects workflow integrity.
 */
import { describe, expect, it, vi } from "vitest";

import { ReviewService } from "@/services/review-service";

const session = {
  userId: "user_employee",
  activeTenantId: "tenant_northstar",
  platformRole: "NONE",
  tenantRole: "EMPLOYEE",
  employeeId: "emp_sam",
  displayName: "Sam Employee",
} as const;

describe("ReviewService.submitSelfReview", () => {
  it("rejects submissions when the assignment is already SUBMITTED", async () => {
    // This test matters because workflow bugs here silently corrupt review process timing and overwrite previously submitted responses.
    const service = new ReviewService({
      reviewRepository: {
        listCycles: vi.fn(),
        findSelfReviewContext: vi.fn().mockResolvedValue({
          assignmentId: "assignment_self_sam",
          cycleId: "cycle_midyear_2026",
          cycleName: "2026 Mid-Year Review",
          cycleStatus: "ACTIVE",
          subjectEmployeeId: "emp_sam",
          reviewerUserId: "user_employee",
          assignmentStatus: "SUBMITTED",
          responseId: null,
        }),
        submitSelfReview: vi.fn(),
      },
      auditLogRepository: {
        create: vi.fn(),
      },
    });

    await expect(
      service.submitSelfReview(session, "cycle_midyear_2026", {
        strengths: "I kept tenant boundaries obvious in each code path.",
        areasToImprove: "I need stronger coverage around background retries.",
        accomplishments: "I shipped the first version of the unified operations UI.",
        overallRating: 4,
        answers: {},
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "This self-review has already been submitted.",
    });
  });
});
