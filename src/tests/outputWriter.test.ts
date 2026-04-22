import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutputWriter } from "../pipeline/outputWriter.js";
import type { PipelineContext, FeatureFlags } from "../types/index.js";

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import fs from "node:fs/promises";

const defaultFlags: FeatureFlags = {
  enableV0Integration: true,
  enableSkillsEngine: true,
  enableTestGeneration: true,
  enableErrorBoundaries: true,
  enableStructuredLogging: false,
};

function makeCtx(framework: "nextjs" | "react"): PipelineContext {
  return {
    featureName: "test-card",
    outputDir: "temp/dist/test-card",
    design: { id: "d1", prompt: "", code: "", framework: "nextjs", createdAt: "" },
    flags: defaultFlags,
    verbose: false,
    framework,
  };
}

describe("OutputWriter", () => {
  const writer = new OutputWriter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes error.tsx for nextjs framework", async () => {
    const ctx = makeCtx("nextjs");
    const output = await writer.write([], [], [], ctx);
    const writtenPaths = vi.mocked(fs.writeFile).mock.calls.map(([p]) => p as string);
    expect(writtenPaths.some((p) => p.endsWith("error.tsx"))).toBe(true);
    expect(output.errorBoundaryFile).toMatch(/error\.tsx$/);
  });

  it("error.tsx content includes use client and reset prop", async () => {
    const ctx = makeCtx("nextjs");
    await writer.write([], [], [], ctx);
    const call = vi.mocked(fs.writeFile).mock.calls.find(([p]) =>
      (p as string).endsWith("error.tsx")
    );
    expect(call).toBeDefined();
    const content = call![1] as string;
    expect(content).toContain('"use client"');
    expect(content).toContain("reset: () => void");
  });

  it("does not write error.tsx for react framework", async () => {
    const ctx = makeCtx("react");
    const output = await writer.write([], [], [], ctx);
    const writtenPaths = vi.mocked(fs.writeFile).mock.calls.map(([p]) => p as string);
    expect(writtenPaths.some((p) => p.endsWith("error.tsx"))).toBe(false);
    expect(output.errorBoundaryFile).toBeUndefined();
  });
});
