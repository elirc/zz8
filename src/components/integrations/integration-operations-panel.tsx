/**
 * What this file does: renders integration config health plus job queue, retry, and worker-trigger controls.
 * What calls it: src/app/integrations/page.tsx.
 * What it calls: integration hooks in src/hooks/useIntegrationOps.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: exposing operational actions without routing them through the same backend permission and status checks as every other client.
 */
"use client";

import { useState } from "react";

import {
  useIntegrationConfigs,
  useIntegrationJobs,
  useProcessQueuedJobs,
  useQueueIntegrationJob,
  useRetryIntegrationJob,
} from "@/hooks/useIntegrationOps";

export function IntegrationOperationsPanel() {
  const configsQuery = useIntegrationConfigs();
  const jobsQuery = useIntegrationJobs();
  const queueMutation = useQueueIntegrationJob();
  const retryMutation = useRetryIntegrationJob();
  const processMutation = useProcessQueuedJobs();
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [payloadJson, setPayloadJson] = useState('{"syncMode":"incremental"}');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [reason, setReason] = useState(
    "Re-queue after reviewing the vendor-side 502 and confirming the mapping set is still valid.",
  );

  const configs = configsQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const selectedConfigIdOrDefault = selectedConfigId || configs[0]?.id || "";

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Operations controls</h3>
            <p className="text-sm text-stone-600">
              Retry and batch processing are explicit actions, not silent side effects.
            </p>
          </div>

          <button
            className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-700"
            disabled={processMutation.isPending}
            onClick={async () => {
              await processMutation.mutateAsync(5);
            }}
            type="button"
          >
            {processMutation.isPending ? "Processing queue..." : "Process queued jobs"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                Config health
              </h4>
              <p className="mt-1 text-sm text-stone-600">
                These configs are tenant-scoped records, not hard-coded client options.
              </p>
            </div>

            <div className="grid gap-3">
              {configs.map((config) => (
                <article
                  key={config.id}
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{config.name}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
                        {config.integrationType} / {config.direction}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        config.isActive
                          ? "bg-teal-50 text-teal-700"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {config.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    Schedule {config.scheduleCron}
                  </p>
                  <p className="text-xs text-stone-500">
                    Last success{" "}
                    {config.lastSuccessfulSyncAt
                      ? new Date(config.lastSuccessfulSyncAt).toLocaleString()
                      : "none recorded"}
                  </p>
                </article>
              ))}

              {configsQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
                  Loading integration configs...
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                Queue a job
              </h4>
              <p className="mt-1 text-sm text-stone-600">
                Queue writes go through the same service layer as retries and batch processing.
              </p>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Integration config
                <select
                  className="input"
                  value={selectedConfigIdOrDefault}
                  onChange={(event) => setSelectedConfigId(event.target.value)}
                >
                  <option value="">Select a config</option>
                  {configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Payload JSON
                <textarea
                  className="input min-h-24 resize-y font-mono text-xs"
                  value={payloadJson}
                  onChange={(event) => {
                    setPayloadJson(event.target.value);
                    setPayloadError(null);
                  }}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Retry reason
                <textarea
                  className="input min-h-24 resize-y"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>

              <button
                className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={queueMutation.isPending || !selectedConfigIdOrDefault}
                onClick={async () => {
                  if (!selectedConfigIdOrDefault) {
                    return;
                  }

                  let payload: Record<string, unknown>;

                  try {
                    payload = JSON.parse(payloadJson) as Record<string, unknown>;
                  } catch {
                    setPayloadError("Payload must be valid JSON before a job can be queued.");
                    return;
                  }

                  await queueMutation.mutateAsync({
                    integrationConfigId: selectedConfigIdOrDefault,
                    payloadJson: payload,
                  });
                }}
                type="button"
              >
                {queueMutation.isPending ? "Queueing job..." : "Queue sync job"}
              </button>

              {payloadError ? <p className="text-sm text-rose-600">{payloadError}</p> : null}
              {queueMutation.error ? (
                <p className="text-sm text-rose-600">
                  {(queueMutation.error as Error).message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-stone-200 bg-stone-50/70 p-5">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-stone-900">Recent sync jobs</h3>
          <p className="text-sm text-stone-600">
            Failed jobs can be retried only when the service layer accepts the transition.
          </p>
        </div>

        <div className="grid gap-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                    {job.integrationConfig.integrationType}
                  </div>
                  <h4 className="mt-1 text-lg font-semibold text-stone-900">
                    {job.integrationConfig.name}
                  </h4>
                  <p className="text-sm text-stone-500">
                    Requested by {job.requestedByUser.displayName} / Attempt {job.attemptCount}
                  </p>
                  {job.retryReason ? (
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
                      Retry reason: {job.retryReason}
                    </p>
                  ) : null}
                  {job.errorMessage ? (
                    <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {job.errorMessage}
                    </p>
                  ) : null}
                  {job.logs.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {job.logs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-600"
                        >
                          <div className="font-semibold uppercase tracking-[0.18em] text-stone-500">
                            {log.level}
                          </div>
                          <div className="mt-1">{log.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex min-w-44 flex-col items-start gap-3">
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {job.status}
                  </span>

                  <button
                    className="rounded-2xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      retryMutation.isPending ||
                      !["FAILED", "RETRY_REQUIRED"].includes(job.status)
                    }
                    onClick={async () => {
                      await retryMutation.mutateAsync({
                        jobId: job.id,
                        reason,
                      });
                    }}
                    type="button"
                  >
                    Retry job
                  </button>
                </div>
              </div>
            </article>
          ))}

          {jobsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
              Loading integration jobs...
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
