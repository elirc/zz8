/**
 * What this file does: standardizes successful and failed JSON responses from Next.js route handlers.
 * What calls it: route files in src/app/api/.
 * What it calls: AppError in src/lib/http/app-error.ts.
 * One thing a junior engineer would likely get wrong when writing something similar: returning inconsistent error payloads that make frontend handling much harder.
 */
import { NextResponse } from "next/server";

import { isAppError } from "@/lib/http/app-error";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function handleRouteError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        message: "Unexpected server error.",
      },
    },
    { status: 500 },
  );
}
