/**
 * What this file does: renders review cycle status and a self-review submission form.
 * What calls it: src/app/reviews/page.tsx.
 * What it calls: review hooks and React state.
 * One thing a junior engineer would likely get wrong when writing something similar: assuming the client-side status badge is enough to enforce the workflow transition.
 */
"use client";

import { useState } from "react";

import { useReviewCycles, useSubmitSelfReview } from "@/hooks/useReviewCycles";

export function ReviewCyclePanel() {
  const reviewCyclesQuery = useReviewCycles();
  const submitMutation = useSubmitSelfReview();
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [strengths, setStrengths] = useState(
    "I improved the tenant-aware backend boundaries and made route-level validation reviewable.",
  );
  const [areasToImprove, setAreasToImprove] = useState(
    "I want to tighten test coverage for async workflows and reduce duplicated DTO mapping.",
  );
  const [accomplishments, setAccomplishments] = useState(
    "Delivered the first unified HR operations surface across HRIS, performance, and integrations.",
  );

  const cycles = reviewCyclesQuery.data ?? [];
  const activeCycle = cycles.find((cycle) => cycle.status === "ACTIVE");
  const cycleId = selectedCycleId || activeCycle?.id;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <section className="rounded-[1.75rem] border border-stone-200 bg-stone-50/70 p-5">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-stone-900">Cycle visibility</h3>
          <p className="text-sm text-stone-600">
            The API only returns the acting employee&apos;s self-review context and goal count.
          </p>
        </div>

        <div className="grid gap-4">
          {cycles.map((cycle) => (
            <article
              key={cycle.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-stone-900">{cycle.name}</h4>
                  <p className="text-sm text-stone-500">
                    {new Date(cycle.startDate).toLocaleDateString()} to{" "}
                    {new Date(cycle.endDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {cycle.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-stone-100 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
                    Self review
                  </div>
                  <div className="mt-1 text-lg font-semibold text-stone-900">
                    {cycle.selfAssignmentStatus ?? "No assignment"}
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-100 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Goals</div>
                  <div className="mt-1 text-lg font-semibold text-stone-900">{cycle.goalCount}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-stone-900">Submit self review</h3>
        <p className="mt-1 text-sm text-stone-600">
          The service rejects invalid workflow transitions even if the UI looks editable.
        </p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            Review cycle
            <select
              className="input"
              value={cycleId ?? ""}
              onChange={(event) => setSelectedCycleId(event.target.value)}
            >
              <option value="">Select a cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            Strengths
            <textarea
              className="input min-h-28 resize-y"
              value={strengths}
              onChange={(event) => setStrengths(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            Areas to improve
            <textarea
              className="input min-h-28 resize-y"
              value={areasToImprove}
              onChange={(event) => setAreasToImprove(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            Accomplishments
            <textarea
              className="input min-h-28 resize-y"
              value={accomplishments}
              onChange={(event) => setAccomplishments(event.target.value)}
            />
          </label>

          <button
            className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
            disabled={!cycleId || submitMutation.isPending}
            onClick={async () => {
              if (!cycleId) {
                return;
              }

              await submitMutation.mutateAsync({
                cycleId,
                input: {
                  strengths,
                  areasToImprove,
                  accomplishments,
                  overallRating: 4,
                  answers: {
                    collaboration: "I partnered closely with People Ops and platform engineering.",
                    delivery: "I made service boundaries explicit and documented the flow end to end.",
                  },
                },
              });
            }}
            type="button"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit self review"}
          </button>

          {submitMutation.error ? (
            <p className="text-sm text-rose-600">{(submitMutation.error as Error).message}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
