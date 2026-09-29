/**
 * What this file does: provides integration configuration reads plus job queue, retry, and process mutations.
 * What calls it: src/components/integrations/integration-operations-panel.tsx.
 * What it calls: the browser API client and demo-session provider.
 * One thing a junior engineer would likely get wrong when writing something similar: invalidating only one query after a write and leaving the rest of the operations dashboard stale.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDemoSession } from "@/components/providers/demo-session-provider";
import { apiFetch } from "@/lib/http/client";

export interface IntegrationConfigViewModel {
  id: string;
  name: string;
  integrationType: string;
  direction: string;
  scheduleCron: string;
  isActive: boolean;
  lastSuccessfulSyncAt: string | null;
}

export interface IntegrationJobViewModel {
  id: string;
  status: string;
  errorMessage: string | null;
  retryReason: string | null;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  payloadJson: unknown;
  integrationConfig: {
    id: string;
    name: string;
    integrationType: string;
  };
  requestedByUser: {
    id: string;
    displayName: string;
  };
  logs: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
}

function invalidateDashboard(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
) {
  void queryClient.invalidateQueries({ queryKey: ["integration-configs", sessionId] });
  void queryClient.invalidateQueries({ queryKey: ["integration-jobs", sessionId] });
}

export function useIntegrationConfigs() {
  const { activeSessionId, headers } = useDemoSession();

  return useQuery({
    queryKey: ["integration-configs", activeSessionId],
    queryFn: () =>
      apiFetch<IntegrationConfigViewModel[]>("/api/integration-configs", {
        demoHeaders: headers,
      }),
  });
}

export function useIntegrationJobs() {
  const { activeSessionId, headers } = useDemoSession();

  return useQuery({
    queryKey: ["integration-jobs", activeSessionId],
    queryFn: () =>
      apiFetch<IntegrationJobViewModel[]>("/api/integration-jobs", {
        demoHeaders: headers,
      }),
  });
}

export function useQueueIntegrationJob() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/integration-jobs", {
        method: "POST",
        body,
        demoHeaders: headers,
      }),
    onSuccess: () => invalidateDashboard(queryClient, activeSessionId),
  });
}

export function useRetryIntegrationJob() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      apiFetch(`/api/integration-jobs/${jobId}/retry`, {
        method: "POST",
        body: { reason },
        demoHeaders: headers,
      }),
    onSuccess: () => invalidateDashboard(queryClient, activeSessionId),
  });
}

export function useProcessQueuedJobs() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchSize: number) =>
      apiFetch("/api/integration-jobs/process", {
        method: "POST",
        body: { batchSize },
        demoHeaders: headers,
      }),
    onSuccess: () => invalidateDashboard(queryClient, activeSessionId),
  });
}
