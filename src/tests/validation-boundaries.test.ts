/**
 * What this file does: verifies that the employee schema rejects a known-bad payload before business logic runs.
 * What calls it: Vitest.
 * What it calls: the createEmployeeSchema validation boundary in src/lib/validation/employeeSchemas.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: asserting only on one invalid field and missing the broader malformed-shape behavior.
 */
import { describe, expect, it } from "vitest";

import { createEmployeeSchema } from "@/lib/validation/employeeSchemas";

describe("createEmployeeSchema", () => {
  it("rejects malformed employee input", () => {
    // This test matters because bad shapes should die at the edge instead of becoming partial writes or surprising service errors.
    const result = createEmployeeSchema.safeParse({
      employeeNumber: "N-300",
      firstName: "Pat",
      lastName: "Broken",
      workEmail: "not-an-email",
      title: "Coordinator",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      compensationCents: -10,
      currency: "USD",
      startDate: "not-a-date",
    });

    expect(result.success).toBe(false);
  });
});
