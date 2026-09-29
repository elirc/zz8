/**
 * What this file does: defines the application error type used to convert domain failures into HTTP responses.
 * What calls it: auth helpers, services, and repositories when a request should fail in a controlled way.
 * What it calls: no internal modules.
 * One thing a junior engineer would likely get wrong when writing something similar: throwing generic Error objects and losing the intended HTTP status at the route boundary.
 */
export class AppError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
