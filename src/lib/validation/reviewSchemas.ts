/**
 * What this file does: validates self-review submissions before they enter workflow logic.
 * What calls it: src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts.
 * What it calls: Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar: validating required text fields but forgetting to cap length for supportability and abuse prevention.
 */
import { z } from "zod";

export const submitSelfReviewSchema = z.object({
  strengths: z.string().min(10).max(2000),
  areasToImprove: z.string().min(10).max(2000),
  accomplishments: z.string().min(10).max(2000),
  overallRating: z.coerce.number().int().min(1).max(5),
  answers: z.record(z.string(), z.string().min(1)).default({}),
});

export type SubmitSelfReviewInput = z.infer<typeof submitSelfReviewSchema>;
