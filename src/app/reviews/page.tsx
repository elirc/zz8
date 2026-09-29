import { ReviewCyclePanel } from "@/components/reviews/review-cycle-panel";
import { AppShell } from "@/components/shell/app-shell";

export default function ReviewsPage() {
  return (
    <AppShell eyebrow="Performance Reviews" title="Review cycles, goals, and self-review workflow">
      <ReviewCyclePanel />
    </AppShell>
  );
}
