/**
 * What this file does: processes a batch of queued integration jobs for the existing service layer.
 * What calls it: src/services/integration-service.ts.
 * What it calls: integration repository methods supplied by the service.
 * One thing a junior engineer would likely get wrong when writing something similar: treating queue processing as a blind status flip instead of emitting logs and terminal states consistently.
 */
import type { IntegrationServiceDeps } from "@/services/integration-service";
import type { RepositoryContext } from "@/repositories/repository-context";

export async function processQueuedIntegrationJobs(
  input: {
    ctx: RepositoryContext;
    batchSize: number;
  },
  deps: IntegrationServiceDeps,
) {
  const jobs = await deps.integrationRepository.claimQueuedJobs(
    input.ctx,
    input.batchSize,
  );

  const processed = [];

  for (const job of jobs) {
    const simulateFailure =
      typeof job.payloadJson === "object" &&
      job.payloadJson !== null &&
      "simulateFailure" in (job.payloadJson as Record<string, unknown>) &&
      Boolean((job.payloadJson as Record<string, unknown>).simulateFailure);

    const completed = await deps.integrationRepository.completeJob(input.ctx, {
      jobId: job.id,
      claimToken: job.claimToken,
      success: !simulateFailure,
      errorMessage: simulateFailure
        ? "Simulated vendor-side failure while processing queued job."
        : null,
    });

    if (completed) {
      await deps.integrationRepository.addLog(input.ctx, {
        jobId: job.id,
        level: simulateFailure ? "ERROR" : "INFO",
        message: simulateFailure
          ? "Job failed during worker processing."
          : "Job completed during worker processing.",
      });
      processed.push(completed);
    }
  }

  return processed;
}
