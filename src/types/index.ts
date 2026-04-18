/**
 * Shared TypeScript types for the frontend-pipeline CLI tool.
 */

/** Severity level for logging */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Feature flags configuration */
export interface FeatureFlags {
  enableV0Integration: boolean;
  enableSkillsEngine: boolean;
  enableTestGeneration: boolean;
  enableErrorBoundaries: boolean;
  enableStructuredLogging: boolean;
  enableObservability: boolean;
}

/** CLI options parsed from command-line arguments */
export interface CLIOptions {
  prompt?: string;
  featureName?: string;
  outputDir?: string;
  designFile?: string;
  designUrl?: string;
  skipValidation: boolean;
  skipTests: boolean;
  skipSkills: boolean;
  verbose: boolean;
  dryRun: boolean;
}

/** A Vercel v0 generated design */
export interface V0Design {
  id: string;
  prompt: string;
  code: string;
  framework: "nextjs" | "react";
  createdAt: string;
}

/** Validation result for a design */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  missingStates: string[];
  suggestions: string[];
}

/** A generated React/Next.js component */
export interface GeneratedComponent {
  name: string;
  path: string;
  code: string;
  isClientComponent: boolean;
  hasTests: boolean;
}

/** Generated hook */
export interface GeneratedHook {
  name: string;
  path: string;
  code: string;
}

/** Generated test file */
export interface GeneratedTest {
  targetComponent: string;
  path: string;
  code: string;
}

/** Full pipeline output */
export interface PipelineOutput {
  featureName: string;
  outputDir: string;
  components: GeneratedComponent[];
  hooks: GeneratedHook[];
  tests: GeneratedTest[];
  indexFile: string;
  externalDependencies: ExternalDependency[];
}

/** A third-party import detected in generated output */
export interface ExternalDependency {
  /** npm package name, e.g. "lucide-react" or "@/components/ui/button" */
  package: string;
  /** Named symbols imported from the package */
  symbols: string[];
  /** Which generated file contains the import */
  sourceFile: string;
}

/** A repository skill/pattern */
export interface Skill {
  name: string;
  description: string;
  pattern: string;
  example?: string;
}

/** Pipeline run context carrying shared state */
export interface PipelineContext {
  featureName: string;
  outputDir: string;
  design: V0Design;
  flags: FeatureFlags;
  verbose: boolean;
}
