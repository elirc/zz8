/**
 * What this file does: accepts self-review submissions for the authenticated employee.
 * What calls it: src/hooks/useReviewCycles.ts.
 * What it calls: buildRouteContext, submitSelfReviewSchema, and the review service factory.
 * One thing a junior engineer would likely get wrong when writing something similar: updating the review status in the route and bypassing workflow validation in the service.
 */
import { buildRouteContext } from "@/lib/http/route-context";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { submitSelfReviewSchema } from "@/lib/validation/reviewSchemas";
import { reviewCycleService } from "@/services/reviewCycleService";

export async function POST(
  request: Request,
  context: { params: Promise<{ cycleId: string }> },
) {
  try {
    const { session } = buildRouteContext(request);
    const { cycleId } = await context.params;
    const input = submitSelfReviewSchema.parse(await request.json());
    const submission = await reviewCycleService.submitSelfReview(
      session,
      cycleId,
      input,
    );
    return ok(submission);
  } catch (error) {
    return handleRouteError(error);
  }
}
