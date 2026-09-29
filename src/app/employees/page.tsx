import { EmployeeDirectory } from "@/components/employees/employee-directory";
import { AppShell } from "@/components/shell/app-shell";

export default function EmployeesPage() {
  return (
    <AppShell eyebrow="HRIS Core" title="Employee records and org structure">
      <EmployeeDirectory />
    </AppShell>
  );
}
