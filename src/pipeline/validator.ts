import type { V0Design, ValidationResult } from "../types/index.js";
import { logger } from "../observability/logger.js";

/** Patterns that indicate client-side-only APIs that block SSR */
const CLIENT_ONLY_PATTERNS = [
  /window\./,
  /document\./,
  /localStorage/,
  /sessionStorage/,
  /navigator\./,
];

/** Known loading/error/empty state identifiers */
const STATE_PATTERNS: Record<string, RegExp> = {
  loading: /loading|skeleton|spinner|isPending|isLoading/i,
  error: /error|catch|onError|ErrorBoundary/i,
  empty: /empty|noData|no.?result|length\s*===\s*0/i,
};

/**
 * Validates a v0 design for feasibility, accessibility gaps, and missing UI
 * states before it is transformed into production components.
 */
export class DesignValidator {
  validate(design: V0Design): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const missingStates: string[] = [];

    if (!design.code || design.code.trim().length === 0) {
      errors.push("Design code is empty.");
    }

    this.checkClientOnlyApis(design.code, warnings);
    this.checkMissingStates(design.code, missingStates);
    this.checkAccessibility(design.code, warnings, suggestions);
    this.checkTypeAnnotations(design.code, suggestions);

    const valid = errors.length === 0;

    if (valid) {
      logger.info("Design validation passed", {
        warnings: warnings.length,
        missingStates: missingStates.length,
      });
    } else {
      logger.warn("Design validation failed", { errors });
    }

    return { valid, warnings, errors, missingStates, suggestions };
  }

  private checkClientOnlyApis(code: string, warnings: string[]): void {
    for (const pattern of CLIENT_ONLY_PATTERNS) {
      if (pattern.test(code)) {
        warnings.push(
          `Detected client-only API (${pattern.source}). ` +
            'Add "use client" directive or move logic to a custom hook.'
        );
      }
    }
  }

  private checkMissingStates(code: string, missingStates: string[]): void {
    for (const [state, pattern] of Object.entries(STATE_PATTERNS)) {
      if (!pattern.test(code)) {
        missingStates.push(state);
      }
    }
  }

  private checkAccessibility(
    code: string,
    warnings: string[],
    suggestions: string[]
  ): void {
    if (/<img/i.test(code) && !/alt=/i.test(code)) {
      warnings.push("Image elements detected without alt attributes.");
    }
    if (/<button/i.test(code) && !/aria-label|aria-labelledby/i.test(code)) {
      suggestions.push("Consider adding aria-label to button elements for better accessibility.");
    }
    if (/<input/i.test(code) && !/<label/i.test(code)) {
      suggestions.push("Input elements should be associated with a <label> for accessibility.");
    }
  }

  private checkTypeAnnotations(code: string, suggestions: string[]): void {
    if (/props\s*\)/.test(code) && !/<.*Props>|interface.*Props/.test(code)) {
      suggestions.push("Consider defining a Props interface for your components.");
    }
  }
}
