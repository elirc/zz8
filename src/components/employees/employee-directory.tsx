/**
 * What this file does: renders the employee directory and a create-employee form for the HRIS slice.
 * What calls it: src/app/employees/page.tsx.
 * What it calls: React Hook Form, employee hooks, and createEmployeeSchema.
 * One thing a junior engineer would likely get wrong when writing something similar: placing validation only in the component and forgetting the route must enforce the same contract.
 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useCreateEmployee, useEmployees } from "@/hooks/useEmployees";
import {
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/lib/validation/employeeSchemas";

const statusOptions = ["ONBOARDING", "ACTIVE", "LEAVE", "TERMINATED"] as const;

export function EmployeeDirectory() {
  const employeesQuery = useEmployees();
  const createEmployeeMutation = useCreateEmployee();
  const form = useForm({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      employeeNumber: "",
      firstName: "",
      lastName: "",
      workEmail: "",
      title: "",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      compensationCents: 12000000,
      currency: "USD",
      startDate: new Date("2026-04-07"),
    },
  });

  const employees = employeesQuery.data ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[1.75rem] border border-stone-200 bg-stone-50/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-stone-900">Employee directory</h3>
            <p className="text-sm text-stone-600">
              Manager, org-unit, and compensation context stay server-owned.
            </p>
          </div>
          <div className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
            {employees.length} records
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-100 text-stone-600">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3">Org</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-stone-500">{employee.employeeNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-700">{employee.title}</td>
                  <td className="px-4 py-3 text-stone-700">{employee.managerName ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-stone-700">{employee.orgUnitName ?? "None"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                      {employee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {employeesQuery.isLoading ? (
            <div className="px-4 py-6 text-sm text-stone-500">Loading employees...</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-stone-900">Add employee</h3>
        <p className="mt-1 text-sm text-stone-600">
          This form hits the same tenant-scoped API that the operational UI uses.
        </p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit(async (values) => {
            await createEmployeeMutation.mutateAsync(values as CreateEmployeeInput);
            form.reset({
              ...(values as CreateEmployeeInput),
              employeeNumber: "",
              firstName: "",
              lastName: "",
              workEmail: "",
              title: "",
            });
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee number" error={form.formState.errors.employeeNumber?.message}>
              <input className="input" {...form.register("employeeNumber")} />
            </Field>
            <Field label="Work email" error={form.formState.errors.workEmail?.message}>
              <input className="input" {...form.register("workEmail")} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name" error={form.formState.errors.firstName?.message}>
              <input className="input" {...form.register("firstName")} />
            </Field>
            <Field label="Last name" error={form.formState.errors.lastName?.message}>
              <input className="input" {...form.register("lastName")} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" error={form.formState.errors.title?.message}>
              <input className="input" {...form.register("title")} />
            </Field>
            <Field label="Employment type" error={form.formState.errors.employmentType?.message}>
              <input className="input" {...form.register("employmentType")} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Status" error={form.formState.errors.status?.message}>
              <select className="input" {...form.register("status")}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Compensation (cents)"
              error={form.formState.errors.compensationCents?.message}
            >
              <input
                className="input"
                type="number"
                {...form.register("compensationCents", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Start date" error={form.formState.errors.startDate?.message as string | undefined}>
              <input
                className="input"
                type="date"
                {...form.register("startDate", {
                  setValueAs: (value) => new Date(value),
                })}
              />
            </Field>
          </div>

          <button
            className="mt-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-700"
            type="submit"
            disabled={createEmployeeMutation.isPending}
          >
            {createEmployeeMutation.isPending ? "Creating employee..." : "Create employee"}
          </button>

          {createEmployeeMutation.error ? (
            <p className="text-sm text-rose-600">
              {(createEmployeeMutation.error as Error).message}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-stone-700">
      {label}
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}
