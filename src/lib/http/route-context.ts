/**
 * What this file does: constructs the authenticated request context shared by API route handlers.
 * What calls it: route handlers under src/app/api/.
 * What it calls: src/lib/auth/session.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: letting each route invent its own request context shape.
 */
import { requireSession } from "@/lib/auth/session";

export function buildRouteContext(request: Request) {
  return {
    session: requireSession(request),
  };
}
