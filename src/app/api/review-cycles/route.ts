/**
 * What this file does: exposes the current actor's review-cycle overview.
 * What calls it: src/hooks/useReviewCycles.ts.
 * What it calls: buildRouteContext and the review service factory.
 * One thing a junior engineer would likely get wrong when writing something similar: returning every assignment in the cycle instead of the actor-specific slice the UI actually needs.
 */
import { buildRouteContext } from "@/lib/http/route-context";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { reviewCycleService } from "@/services/reviewCycleService";

export async function GET(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const cycles = await reviewCycleService.listCycles(session);
    return ok(cycles);
  } catch (error) {
    return handleRouteError(error);
  }
}
