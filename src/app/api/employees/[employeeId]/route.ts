/**
 * What this file does: exposes single-employee read and patch operations.
 * What calls it: employee detail queries and update mutations from UI hooks.
 * What it calls: route context builder, Zod update schema, employee service wrapper, and JSON response helpers.
 * One thing a junior engineer would likely get wrong when writing something similar: trusting the dynamic route id and body separately without sending both through the same tenant-aware service.
 */
import { handleRouteError, ok } from "@/lib/http/api-response";
import { buildRouteContext } from "@/lib/http/route-context";
import { updateEmployeeSchema } from "@/lib/validation/employeeSchemas";
import { employeeService } from "@/services/employeeService";

interface RouteParams {
  params: Promise<{
    employeeId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { session } = buildRouteContext(request);
    const { employeeId } = await params;
    const employee = await employeeService.getEmployee(session, employeeId);
    return ok(employee);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { session } = buildRouteContext(request);
    const { employeeId } = await params;
    const input = updateEmployeeSchema.parse(await request.json());
    const employee = await employeeService.updateEmployee(session, employeeId, input);
    return ok(employee);
  } catch (error) {
    return handleRouteError(error);
  }
}
