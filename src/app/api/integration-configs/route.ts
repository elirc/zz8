/**
 * What this file does: exposes tenant-scoped integration configuration reads for the operations dashboard.
 * What calls it: src/hooks/useIntegrationOps.ts.
 * What it calls: buildRouteContext, integrationService, and shared JSON helpers.
 * One thing a junior engineer would likely get wrong when writing something similar: returning platform-wide integration configs because the view is "internal" and forgetting tenant isolation still applies.
 */
import { handleRouteError, ok } from "@/lib/http/api-response";
import { buildRouteContext } from "@/lib/http/route-context";
import { integrationService } from "@/services/integrationService";

export async function GET(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const configs = await integrationService.listConfigs(session);
    return ok(configs);
  } catch (error) {
    return handleRouteError(error);
  }
}
