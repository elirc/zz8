import { IntegrationOperationsPanel } from "@/components/integrations/integration-operations-panel";
import { AppShell } from "@/components/shell/app-shell";

export default function IntegrationsPage() {
  return (
    <AppShell eyebrow="Integration Hub" title="Async jobs, retries, and operational controls">
      <IntegrationOperationsPanel />
    </AppShell>
  );
}
