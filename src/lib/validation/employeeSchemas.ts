/**
 * What this file does: defines the request validation boundary for employee create and update APIs.
 * What calls it: employee routes in src/app/api/employees/.
 * What it calls: shared domain enums in src/lib/domain.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: trusting HTML form strings and never coercing dates or numbers at the boundary.
 */
import { z } from "zod";

import { EMPLOYMENT_STATUSES } from "@/lib/domain";

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(2).max(24),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  workEmail: z.string().email(),
  title: z.string().min(2).max(120),
  employmentType: z.string().min(2).max(32),
  status: z.enum(EMPLOYMENT_STATUSES),
  compensationCents: z.coerce.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  startDate: z.coerce.date(),
  managerId: z.string().min(1).optional(),
  orgUnitId: z.string().min(1).optional(),
});

// ⚠️ SENIOR NOTE: partial update schemas should still constrain the field set; `z.any()` patches are a classic source of silent data corruption.
export const updateEmployeeSchema = createEmployeeSchema
  .pick({
    title: true,
    status: true,
    compensationCents: true,
    managerId: true,
    orgUnitId: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied for update.",
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
