import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promptMissingOptions } from "../cli/promptUser.js";
import type { CLIOptions } from "../types/index.js";

function baseOptions(overrides: Partial<CLIOptions> = {}): CLIOptions {
  return {
    skipValidation: false,
    skipTests: false,
    skipSkills: false,
    verbose: false,
    dryRun: false,
    ...overrides,
  };
}

describe("promptMissingOptions — non-TTY", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("throws when --feature-name is missing", async () => {
    const opts = baseOptions({ prompt: "a test prompt" });
    await expect(promptMissingOptions(opts)).rejects.toThrow(/--feature-name/);
  });

  it("throws when no design source is provided", async () => {
    const opts = baseOptions({ featureName: "my-card" });
    await expect(promptMissingOptions(opts)).rejects.toThrow(/--prompt/);
  });

  it("throws listing all missing required fields at once", async () => {
    const opts = baseOptions();
    await expect(promptMissingOptions(opts)).rejects.toThrow(/--feature-name/);
  });

  it("applies default outputDir and framework silently when required fields are present", async () => {
    const opts = baseOptions({ featureName: "card", prompt: "test" });
    const result = await promptMissingOptions(opts);
    expect(result.outputDir).toBe("temp/dist");
    expect(result.framework).toBe("nextjs");
  });

  it("preserves explicitly passed optional values without overwriting", async () => {
    const opts = baseOptions({
      featureName: "card",
      prompt: "test",
      outputDir: "custom/output",
      framework: "react",
    });
    const result = await promptMissingOptions(opts);
    expect(result.outputDir).toBe("custom/output");
    expect(result.framework).toBe("react");
  });

  it("accepts designUrl as valid design source", async () => {
    const opts = baseOptions({ featureName: "card", designUrl: "https://v0.app/chat/abc" });
    const result = await promptMissingOptions(opts);
    expect(result.featureName).toBe("card");
  });

  it("accepts designFile as valid design source", async () => {
    const opts = baseOptions({ featureName: "card", designFile: "temp/designs/test.json" });
    const result = await promptMissingOptions(opts);
    expect(result.featureName).toBe("card");
  });
});
