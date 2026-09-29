/**
 * What this file does: provides employee list, create, and update hooks backed by React Query.
 * What calls it: src/components/employees/employee-directory.tsx.
 * What it calls: the browser API client and demo-session provider.
 * One thing a junior engineer would likely get wrong when writing something similar: mutating local component state only and forgetting to invalidate the server-backed cache.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDemoSession } from "@/components/providers/demo-session-provider";
import { apiFetch } from "@/lib/http/client";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@/lib/validation/employeeSchemas";

export function useEmployees(search?: string) {
  const { activeSessionId, headers } = useDemoSession();

  return useQuery({
    queryKey: ["employees", activeSessionId, search ?? ""],
    queryFn: async () => {
      const employees = await apiFetch<
        Array<{
          id: string;
          employeeNumber: string;
          firstName: string;
          lastName: string;
          title: string;
          status: string;
          manager: { firstName: string; lastName: string } | null;
          orgUnit: { name: string } | null;
          compensationCents: number;
        }>
      >(`/api/employees${search ? `?search=${encodeURIComponent(search)}` : ""}`, {
        demoHeaders: headers,
      });

      return employees.map((employee) => ({
        ...employee,
        managerName: employee.manager
          ? `${employee.manager.firstName} ${employee.manager.lastName}`
          : null,
        orgUnitName: employee.orgUnit?.name ?? null,
      }));
    },
  });
}

export function useCreateEmployee() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiFetch("/api/employees", {
        method: "POST",
        body: input,
        demoHeaders: headers,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees", activeSessionId] });
    },
  });
}

export function useUpdateEmployee() {
  const { activeSessionId, headers } = useDemoSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      input,
    }: {
      employeeId: string;
      input: UpdateEmployeeInput;
    }) =>
      apiFetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: input,
        demoHeaders: headers,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees", activeSessionId] });
    },
  });
}
