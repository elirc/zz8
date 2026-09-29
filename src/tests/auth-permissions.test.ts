/**
 * What this file does: verifies a protected employee-creation endpoint rejects an unauthorized caller.
 * What calls it: Vitest.
 * What it calls: the employee POST route in src/app/api/employees/route.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: testing only the UI state and never proving the backend route returns the intended status code.
 */
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/employees/route";

describe("POST /api/employees", () => {
  it("rejects an EMPLOYEE session with 403", async () => {
    // This matters because UI-only permission checks do not protect API clients or scripted calls.
    const response = await POST(
      new Request("http://localhost/api/employees", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user_employee",
          "x-demo-tenant-id": "tenant_northstar",
        },
        body: JSON.stringify({
          employeeNumber: "N-250",
          firstName: "Casey",
          lastName: "Analyst",
          workEmail: "casey.analyst@northstar.test",
          title: "HR Analyst",
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          compensationCents: 9900000,
          currency: "USD",
          startDate: "2026-04-07",
        }),
      }),
    );

    const payload = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(403);
    expect(payload.error.message).toContain("cannot create employees");
  });
});
