"use client";

/**
 * What this file does: wraps the app with React Query and the demo-session provider used by client hooks.
 * What calls it: src/app/layout.tsx.
 * What it calls: TanStack Query and the demo-session provider in this directory.
 * One thing a junior engineer would likely get wrong when writing something similar: creating a new QueryClient on every render and invalidating the cache constantly.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

import { DemoSessionProvider } from "@/components/providers/demo-session-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DemoSessionProvider>{children}</DemoSessionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
