"use client";

/**
 * What this file does: keeps the selected demo session in React state so the UI can exercise different roles against the same backend.
 * What calls it: src/components/providers/app-providers.tsx and hooks/components that consume `useDemoSession`.
 * What it calls: demo session definitions in src/lib/demo/demo-sessions.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: storing auth-like state in many independent components instead of a single source of truth.
 */
import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  DEMO_SESSION_STORAGE_KEY,
  DEFAULT_DEMO_SESSION,
  demoSessionOptions,
  demoSessions,
} from "@/lib/demo/demo-sessions";

interface DemoSessionContextValue {
  activeSessionId: string;
  setActiveSessionId: (sessionId: string) => void;
  headers: {
    userId: string;
    tenantId: string;
  };
  displayName: string;
  tenantRole: string;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSessionId, setActiveSessionIdState] = useState(() => {
    if (typeof window === "undefined") {
      return "user_hr_admin";
    }

    const storedSessionId = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    return storedSessionId && demoSessions[storedSessionId]
      ? storedSessionId
      : "user_hr_admin";
  });

  const value = useMemo(() => {
    const session = demoSessions[activeSessionId] ?? DEFAULT_DEMO_SESSION;

    return {
      activeSessionId,
      setActiveSessionId: (sessionId: string) => {
        startTransition(() => {
          setActiveSessionIdState(sessionId);
          window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, sessionId);
        });
      },
      headers: {
        userId: session.userId,
        tenantId: session.activeTenantId,
      },
      displayName: session.displayName,
      tenantRole: session.tenantRole,
    };
  }, [activeSessionId]);

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const value = useContext(DemoSessionContext);

  if (!value) {
    throw new Error("useDemoSession must be used inside DemoSessionProvider.");
  }

  return {
    ...value,
    options: demoSessionOptions,
  };
}
