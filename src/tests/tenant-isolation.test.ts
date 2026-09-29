/**
 * What this file does: verifies a tenant-scoped repository double does not return another tenant's employee by id.
 * What calls it: Vitest.
 * What it calls: a small in-memory repository used to model the same tenant-scoping contract as the Prisma repositories.
 * One thing a junior engineer would likely get wrong when writing something similar: treating globally unique ids as sufficient protection and skipping the tenant filter altogether.
 */
import { describe, expect, it } from "vitest";

interface InMemoryEmployee {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
}

class InMemoryEmployeeRepository {
  constructor(private readonly employees: InMemoryEmployee[]) {}

  async findById(tenantId: string, employeeId: string) {
    return (
      this.employees.find(
        (employee) =>
          employee.id === employeeId && employee.tenantId === tenantId,
      ) ?? null
    );
  }
}

describe("tenant-scoped employee reads", () => {
  it("do not return an employee from another tenant", async () => {
    // This test matters because cross-tenant data leaks are often one missing filter away and can remain invisible in single-tenant dev data.
    const repository = new InMemoryEmployeeRepository([
      {
        id: "emp_sam",
        tenantId: "tenant_northstar",
        firstName: "Sam",
        lastName: "Patel",
      },
      {
        id: "emp_atlas_hr",
        tenantId: "tenant_atlas",
        firstName: "Aria",
        lastName: "Quinn",
      },
    ]);

    const result = await repository.findById("tenant_northstar", "emp_atlas_hr");

    expect(result).toBeNull();
  });
});
