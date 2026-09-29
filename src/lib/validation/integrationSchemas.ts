/**
 * What this file does: validates integration retry requests and worker-trigger requests.
 * What calls it: integration route handlers in src/app/api/integration-jobs/.
 * What it calls: Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar: treating support/debug tooling as “internal only” and skipping validation entirely.
 */
import { z } from "zod";

export const queueIntegrationJobSchema = z.object({
  integrationConfigId: z.string().min(1),
  payloadJson: z.record(z.string(), z.unknown()).default({}),
});

export const retryIntegrationJobSchema = z.object({
  reason: z.string().min(8).max(280),
});

export const processQueuedJobsSchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(20).default(5),
});

export type QueueIntegrationJobInput = z.infer<typeof queueIntegrationJobSchema>;
export type RetryIntegrationJobInput = z.infer<typeof retryIntegrationJobSchema>;
export type ProcessQueuedJobsInput = z.infer<typeof processQueuedJobsSchema>;
