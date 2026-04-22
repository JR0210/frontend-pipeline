import { logger } from "./logger.js";

export interface PipelineError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * Tracks and formats pipeline errors, emitting structured log entries.
 * In a production setup this would forward to an error monitoring service
 * (e.g. Sentry, Datadog).
 */
export class ErrorTracker {
  private readonly errors: PipelineError[] = [];

  /** Record an error and emit a log entry. */
  capture(error: PipelineError): void {
    this.errors.push(error);
    logger.error(`[${error.code}] ${error.message}`, {
      code: error.code,
      context: error.context,
      cause: error.cause instanceof Error ? error.cause.message : String(error.cause ?? ""),
    });
  }

  /** Wrap a thrown value as a PipelineError and capture it. */
  captureException(code: string, err: unknown, context?: Record<string, unknown>): void {
    const message = err instanceof Error ? err.message : String(err);
    this.capture({ code, message, context, cause: err });
  }

  /** Return all captured errors. */
  getErrors(): ReadonlyArray<PipelineError> {
    return this.errors;
  }

  /** True if any errors have been captured. */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /** Clear all captured errors. */
  clear(): void {
    this.errors.length = 0;
  }
}

/** Shared singleton tracker for the current pipeline run. */
export const errorTracker = new ErrorTracker();
