import type { FeatureFlags } from "../types/index.js";

const DEFAULT_FLAGS: FeatureFlags = {
  enableV0Integration: true,
  enableSkillsEngine: true,
  enableTestGeneration: true,
  enableErrorBoundaries: true,
  enableStructuredLogging: false,
  enableObservability: true,
};

/**
 * Resolves feature flags by merging environment variables over the defaults.
 * Each flag can be overridden via an environment variable of the form:
 *   PIPELINE_FLAG_<UPPER_SNAKE_CASE_NAME>=true|false
 *
 * Example: PIPELINE_FLAG_ENABLE_V0_INTEGRATION=false
 */
export function resolveFlags(overrides?: Partial<FeatureFlags>): FeatureFlags {
  const env = process.env;

  const fromEnv = (key: keyof FeatureFlags): boolean | undefined => {
    const envKey = `PIPELINE_FLAG_${toEnvKey(key)}`;
    const val = env[envKey];
    if (val === undefined) return undefined;
    return val.toLowerCase() === "true";
  };

  const resolved: FeatureFlags = { ...DEFAULT_FLAGS };

  for (const key of Object.keys(DEFAULT_FLAGS) as Array<keyof FeatureFlags>) {
    const envVal = fromEnv(key);
    if (envVal !== undefined) {
      resolved[key] = envVal;
    }
    if (overrides && key in overrides && overrides[key] !== undefined) {
      resolved[key] = overrides[key] as boolean;
    }
  }

  return resolved;
}

/** Check a single feature flag. */
export function isEnabled(flags: FeatureFlags, flag: keyof FeatureFlags): boolean {
  return flags[flag];
}

function toEnvKey(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, "_$1")
    .toUpperCase()
    .replace(/^_/, "");
}
