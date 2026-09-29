/**
 * What this file does: exposes the employee collection API for list and create operations.
 * What calls it: React Query hooks in src/hooks/useEmployees.ts and any API client that targets /api/employees.
 * What it calls: route context builder, Zod schemas, employee service factory, and JSON response helpers.
 * One thing a junior engineer would likely get wrong when writing something similar: letting the route file absorb business rules that belong in the service layer.
 */
import { created, handleRouteError, ok } from "@/lib/http/api-response";
import { buildRouteContext } from "@/lib/http/route-context";
import { createEmployeeSchema } from "@/lib/validation/employeeSchemas";
import { employeeService } from "@/services/employeeService";

export async function GET(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const employees = await employeeService.listEmployees(session);
    return ok(employees);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = buildRouteContext(request);
    const input = createEmployeeSchema.parse(await request.json());
    const employee = await employeeService.createEmployee(session, input);
    return created(employee);
  } catch (error) {
    return handleRouteError(error);
  }
}
