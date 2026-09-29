/**
 * What this file does: exposes an operator-triggered endpoint for processing queued integration jobs.
 * What calls it: src/hooks/useIntegrationOps.ts.
 * What it calls: buildRouteContext, processQueuedJobsSchema, runIntegrationJobSweep(), and JSON helpers.
 * One thing a junior engineer would likely get wrong when writing something similar: letting the route iterate the queue directly and duplicating worker logic outside the job module.
 */
import { handleRouteError, ok } from "@/lib/http/api-response";
import { buildRouteContext } from "@/lib/http/route-context";
import { processQueuedJobsSchema } from "@/lib/validation/integrationSchemas";
import { runIntegrationJobSweep } from "@/jobs/processIntegrationJobs";

export async function POST(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const input = processQueuedJobsSchema.parse(await request.json());
    const processedJobs = await runIntegrationJobSweep(session, input);
    return ok(processedJobs);
  } catch (error) {
    return handleRouteError(error);
  }
}
