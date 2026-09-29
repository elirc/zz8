/**
 * What this file does: exposes tenant-scoped integration job history and queueing over REST.
 * What calls it: src/hooks/useIntegrationOps.ts.
 * What it calls: buildRouteContext, integration Zod schemas, integrationService, and JSON helpers.
 * One thing a junior engineer would likely get wrong when writing something similar: assuming support tooling does not need the same permission rigor as customer-facing CRUD screens.
 */
import { created, handleRouteError, ok } from "@/lib/http/api-response";
import { buildRouteContext } from "@/lib/http/route-context";
import { queueIntegrationJobSchema } from "@/lib/validation/integrationSchemas";
import { integrationService } from "@/services/integrationService";

export async function GET(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const jobs = await integrationService.listJobs(session);
    return ok(jobs);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const input = queueIntegrationJobSchema.parse(await request.json());
    const job = await integrationService.queueJob(session, input);
    return created(job);
  } catch (error) {
    return handleRouteError(error);
  }
}
