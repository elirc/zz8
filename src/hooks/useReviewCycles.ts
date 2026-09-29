/**
 * What this file does: provides review-cycle queries and self-review mutations for the UI.
 * What calls it: src/components/reviews/review-cycle-panel.tsx.
 * What it calls: the browser API client and demo-session provider.
 * One thing a junior engineer would likely get wrong when writing something similar: forgetting that a mutation should refresh the list view that depends on the updated workflow state.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDemoSession } from "@/components/providers/demo-session-provider";
import { apiFetch } from "@/lib/http/client";

export function useReviewCycles() {
  const { activeSessionId, headers } = useDemoSession();

  return useQuery({
    queryKey: ["review-cycles", activeSessionId],
    queryFn: async () => {
      const cycles = await apiFetch<
        Array<{
          id: string;
          name: string;
          status: string;
          startDate: string;
          endDate: string;
          counts: {
            goals: number;
            reviewAssignments: number;
            feedbackRequests: number;
          };
        }>
      >("/api/review-cycles", {
        demoHeaders: headers,
      });

      return cycles.map((cycle) => ({
        ...cycle,
        selfAssignmentStatus:
          cycle.status === "ACTIVE" ? "AVAILABLE" : cycle.status,
        goalCount: cycle.counts.goals,
      }));
    },
  });
}

export function useSubmitSelfReview() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      input,
    }: {
      cycleId: string;
      input: {
        strengths: string;
        areasToImprove: string;
        accomplishments: string;
        overallRating: number;
        answers: Record<string, string>;
      };
    }) =>
      apiFetch(`/api/review-cycles/${cycleId}/submit-self-review`, {
        method: "POST",
        body: input,
        demoHeaders: headers,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["review-cycles", activeSessionId] });
    },
  });
}
