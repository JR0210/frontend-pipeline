import { describe, it, expect, beforeEach } from "vitest";
import { resolveFlags, isEnabled } from "../observability/flags.js";
import type { FeatureFlags } from "../types/index.js";

describe("resolveFlags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns default flags when no env vars or overrides are provided", () => {
    const flags = resolveFlags();
    expect(flags.enableV0Integration).toBe(true);
    expect(flags.enableSkillsEngine).toBe(true);
    expect(flags.enableTestGeneration).toBe(true);
    expect(flags.enableStructuredLogging).toBe(false);
  });

  it("applies overrides passed directly", () => {
    const flags = resolveFlags({ enableV0Integration: false });
    expect(flags.enableV0Integration).toBe(false);
    expect(flags.enableSkillsEngine).toBe(true);
  });

  it("reads boolean flags from environment variables", () => {
    process.env["PIPELINE_FLAG_ENABLE_V0_INTEGRATION"] = "false";
    const flags = resolveFlags();
    expect(flags.enableV0Integration).toBe(false);
  });

  it("treats any value other than 'true' as false", () => {
    process.env["PIPELINE_FLAG_ENABLE_TEST_GENERATION"] = "yes";
    const flags = resolveFlags();
    expect(flags.enableTestGeneration).toBe(false);
  });

  it("direct overrides take precedence over env vars", () => {
    process.env["PIPELINE_FLAG_ENABLE_V0_INTEGRATION"] = "false";
    const flags = resolveFlags({ enableV0Integration: true });
    expect(flags.enableV0Integration).toBe(true);
  });
});

describe("isEnabled", () => {
  const flags: FeatureFlags = {
    enableV0Integration: true,
    enableSkillsEngine: false,
    enableTestGeneration: true,
    enableErrorBoundaries: true,
    enableStructuredLogging: false,
    enableObservability: true,
  };

  it("returns true for an enabled flag", () => {
    expect(isEnabled(flags, "enableV0Integration")).toBe(true);
  });

  it("returns false for a disabled flag", () => {
    expect(isEnabled(flags, "enableSkillsEngine")).toBe(false);
  });
});
