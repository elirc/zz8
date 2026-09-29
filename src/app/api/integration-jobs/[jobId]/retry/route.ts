/**
 * What this file does: retries a failed integration job for the active tenant.
 * What calls it: src/hooks/useIntegrationOps.ts.
 * What it calls: buildRouteContext, retryIntegrationJobSchema, and the integration service factory.
 * One thing a junior engineer would likely get wrong when writing something similar: skipping the current-status check and allowing arbitrary jobs to be re-queued.
 */
import { buildRouteContext } from "@/lib/http/route-context";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { retryIntegrationJobSchema } from "@/lib/validation/integrationSchemas";
import { integrationService } from "@/services/integrationService";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { session } = buildRouteContext(request);
    const { jobId } = await context.params;
    const input = retryIntegrationJobSchema.parse(await request.json());
    const job = await integrationService.retryJob(session, jobId, input);
    return ok(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
