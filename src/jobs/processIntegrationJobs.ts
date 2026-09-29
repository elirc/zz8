/**
 * What this file does: provides a worker-style entrypoint for draining queued integration jobs.
 * What calls it: src/app/api/integration-jobs/process/route.ts and any future scheduler.
 * What it calls: the integration service compatibility export in src/services/integrationService.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: letting the route own background processing instead of routing through a callable job module.
 */
import type { AppSession } from "@/lib/domain";
import { integrationService } from "@/services/integrationService";

export async function runIntegrationJobSweep(
  session: AppSession,
  input: { batchSize: number },
) {
  return integrationService.processQueuedJobs(session, input);
}
