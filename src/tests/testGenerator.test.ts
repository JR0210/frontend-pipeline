import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TestGenerator } from "../pipeline/testGenerator.js";
import type { GeneratedComponent, PipelineContext, FeatureFlags } from "../types/index.js";

const defaultFlags: FeatureFlags = {
  enableV0Integration: true,
  enableSkillsEngine: true,
  enableTestGeneration: true,
  enableErrorBoundaries: true,
  enableStructuredLogging: false,
};

function makeComponent(
  name: string,
  isClientComponent: boolean,
  outputDir: string
): GeneratedComponent {
  return {
    name,
    path: `${outputDir}/components/${name.toLowerCase()}.tsx`,
    code: `export function ${name}() { return <div />; }`,
    isClientComponent,
    hasTests: false,
  };
}

describe("TestGenerator", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "test-gen-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeCtx(featureName: string): PipelineContext {
    return {
      featureName,
      outputDir: tmpDir,
      design: {
        id: "d1",
        prompt: "test",
        code: "",
        framework: "nextjs",
        createdAt: "",
      },
      flags: defaultFlags,
      verbose: false,
      framework: "nextjs",
    };
  }

  it("generates one test per component", () => {
    const ctx = makeCtx("dashboard");
    const components = [
      makeComponent("Dashboard", false, tmpDir),
      makeComponent("DashboardWrapper", false, tmpDir),
    ];
    const generator = new TestGenerator();
    const tests = generator.generate(components, ctx);
    expect(tests).toHaveLength(2);
  });

  it("test code imports the component", () => {
    const ctx = makeCtx("card");
    const components = [makeComponent("Card", false, tmpDir)];
    const generator = new TestGenerator();
    const [test] = generator.generate(components, ctx);
    expect(test.code).toContain("import");
    expect(test.code).toContain("Card");
  });

  it("sets the correct output path", () => {
    const ctx = makeCtx("my-button");
    const components = [makeComponent("MyButton", false, tmpDir)];
    const generator = new TestGenerator();
    const [test] = generator.generate(components, ctx);
    expect(test.path).toContain("tests");
    expect(test.path).toContain(".test.tsx");
  });

  it("adds keyboard interaction test for client components", () => {
    const ctx = makeCtx("counter");
    const components = [makeComponent("Counter", true, tmpDir)];
    const generator = new TestGenerator();
    const [test] = generator.generate(components, ctx);
    expect(test.code).toContain("keyboard interaction");
  });

  it("does not add keyboard interaction test for server components", () => {
    const ctx = makeCtx("static");
    const components = [makeComponent("Static", false, tmpDir)];
    const generator = new TestGenerator();
    const [test] = generator.generate(components, ctx);
    expect(test.code).not.toContain("keyboard interaction");
  });
});
