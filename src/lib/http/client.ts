/**
 * What this file does: centralizes browser-side API calls and attaches the selected demo-session headers.
 * What calls it: React Query hooks under src/hooks/.
 * What it calls: demo header constants from src/lib/demo/demo-sessions.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: duplicating fetch/error logic in every hook until clients disagree on response parsing.
 */
import {
  DEFAULT_DEMO_SESSION,
  DEMO_HEADER_TENANT,
  DEMO_HEADER_USER,
  DEMO_SESSION_STORAGE_KEY,
  demoSessions,
} from "@/lib/demo/demo-sessions";

export interface DemoRequestHeaders {
  userId: string;
  tenantId: string;
}

function getStoredDemoHeaders(): DemoRequestHeaders {
  if (typeof window === "undefined") {
    return {
      userId: DEFAULT_DEMO_SESSION.userId,
      tenantId: DEFAULT_DEMO_SESSION.activeTenantId,
    };
  }

  const storedSessionId = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
  const session =
    (storedSessionId ? demoSessions[storedSessionId] : undefined) ?? DEFAULT_DEMO_SESSION;

  return {
    userId: session.userId,
    tenantId: session.activeTenantId,
  };
}

export async function apiFetch<T>(
  path: string,
  input?: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    demoHeaders?: DemoRequestHeaders;
  },
): Promise<T> {
  const headers = input?.demoHeaders ?? getStoredDemoHeaders();
  const response = await fetch(path, {
    method: input?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      [DEMO_HEADER_USER]: headers.userId,
      [DEMO_HEADER_TENANT]: headers.tenantId,
    },
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    data?: T;
    error?: { message: string };
  };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }

  return payload.data;
}
