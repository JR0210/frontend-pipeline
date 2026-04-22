import path from "node:path";
import type {
  V0Design,
  PipelineContext,
  PipelineOutput,
  CLIOptions,
  FeatureFlags,
} from "../types/index.js";
import { V0Client } from "./v0Client.js";
import { V0ChatFetcher } from "./v0ChatFetcher.js";
import { DesignStore } from "./designStore.js";
import { DesignValidator } from "./validator.js";
import { ComponentTransformer } from "./transformer.js";
import { SkillsEngine } from "./skillsEngine.js";
import { TestGenerator } from "./testGenerator.js";
import { OutputWriter } from "./outputWriter.js";
import { DependencyAnalyser } from "./dependencyAnalyser.js";
import { logger } from "../observability/logger.js";
import { errorTracker } from "../observability/errorTracker.js";
import { isEnabled } from "../observability/flags.js";

const OUTPUT_BASE = path.resolve("temp", "dist");

/**
 * Orchestrates the full frontend-pipeline workflow:
 *  1. Fetch or load a v0 design
 *  2. Validate the design
 *  3. Transform into React/Next.js components
 *  4. Apply repository skills
 *  5. Generate tests
 *  6. Write output to disk
 */
export class Pipeline {
  private readonly v0Client: V0Client;
  private readonly v0ChatFetcher: V0ChatFetcher;
  private readonly designStore: DesignStore;
  private readonly validator: DesignValidator;
  private readonly transformer: ComponentTransformer;
  private readonly skillsEngine: SkillsEngine;
  private readonly testGenerator: TestGenerator;
  private readonly outputWriter: OutputWriter;
  private readonly dependencyAnalyser: DependencyAnalyser;

  constructor() {
    this.v0Client = new V0Client();
    this.v0ChatFetcher = new V0ChatFetcher();
    this.designStore = new DesignStore();
    this.validator = new DesignValidator();
    this.transformer = new ComponentTransformer();
    this.skillsEngine = new SkillsEngine();
    this.testGenerator = new TestGenerator();
    this.outputWriter = new OutputWriter();
    this.dependencyAnalyser = new DependencyAnalyser();
  }

  async run(options: CLIOptions, flags: FeatureFlags): Promise<PipelineOutput> {
    const featureName = options.featureName ?? "generated-feature";
    const outputDir = path.join(options.outputDir ?? OUTPUT_BASE, featureName);

    logger.info("Pipeline started", { featureName, outputDir });

    // ── 1. Acquire design ────────────────────────────────────────────────────
    let design: V0Design;
    try {
      design = await this.acquireDesign(options, flags);
    } catch (err) {
      errorTracker.captureException("DESIGN_ACQUISITION_FAILED", err);
      throw err;
    }

    // ── 2. Validate ──────────────────────────────────────────────────────────
    if (!options.skipValidation) {
      const result = this.validator.validate(design);
      if (!result.valid) {
        const msg = `Design validation failed: ${result.errors.join(", ")}`;
        errorTracker.capture({ code: "VALIDATION_FAILED", message: msg });
        throw new Error(msg);
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => logger.warn(`Validation warning: ${w}`));
      }
      if (result.missingStates.length > 0) {
        logger.warn("Missing UI states detected", { states: result.missingStates });
      }
    }

    const ctx: PipelineContext = {
      featureName,
      outputDir,
      design,
      flags,
      verbose: options.verbose,
      framework: options.framework ?? "nextjs",
    };

    // ── 3. Load skills ───────────────────────────────────────────────────────
    if (isEnabled(flags, "enableSkillsEngine") && !options.skipSkills) {
      await this.skillsEngine.loadSkills();
    }

    // ── 4. Transform design → components ────────────────────────────────────
    const components = this.transformer.transform(design, ctx);

    // Apply skills to each component
    if (isEnabled(flags, "enableSkillsEngine") && !options.skipSkills) {
      for (const component of components) {
        component.code = this.skillsEngine.applyToCode(component.code);
      }
    }

    // ── 5. Generate hooks ────────────────────────────────────────────────────
    const hookResult = this.transformer.buildHook(design, ctx);
    const hooks = hookResult ? [hookResult] : [];

    // ── 5b. Analyse external dependencies ───────────────────────────────────
    const externalDependencies = this.dependencyAnalyser.analyse(components, hooks);
    if (externalDependencies.length > 0) {
      const packages = [...new Set(externalDependencies.map((d) => d.package))];
      logger.warn(`External dependencies detected — install in target project: ${packages.join(", ")}`);
      // Annotate component code with inline TODO comments
      for (const component of components) {
        const fileDeps = externalDependencies.filter((d) => d.sourceFile === path.basename(component.path));
        component.code = this.dependencyAnalyser.annotateCode(component.code, fileDeps);
      }
      for (const hook of hooks) {
        const fileDeps = externalDependencies.filter((d) => d.sourceFile === path.basename(hook.path));
        hook.code = this.dependencyAnalyser.annotateCode(hook.code, fileDeps);
      }
    }

    // ── 6. Generate tests ────────────────────────────────────────────────────
    const tests =
      isEnabled(flags, "enableTestGeneration") && !options.skipTests
        ? this.testGenerator.generate(components, ctx)
        : [];

    // ── 7. Write output ──────────────────────────────────────────────────────
    if (!options.dryRun) {
      const output = await this.outputWriter.write(components, hooks, tests, ctx);
      logger.info("Pipeline complete", { outputDir: output.outputDir });
      return { ...output, externalDependencies };
    }

    logger.info("Dry-run mode — no files written.");
    return { featureName, outputDir, components, hooks, tests, indexFile: "", externalDependencies, errorBoundaryFile: undefined };
  }

  private async acquireDesign(options: CLIOptions, flags: FeatureFlags): Promise<V0Design> {
    // Fetch from a v0.app chat URL
    if (options.designUrl) {
      logger.info("Fetching design from v0 chat URL", { url: options.designUrl });
      const design = await this.v0ChatFetcher.fetchFromUrl(options.designUrl);
      await this.designStore.save(design);
      return design;
    }

    // Load from a pre-existing file if provided
    if (options.designFile) {
      logger.info("Loading design from file", { path: options.designFile });
      return this.designStore.loadFromPath(options.designFile);
    }

    // Call v0 API for a new design (skipped in dry-run mode)
    if (isEnabled(flags, "enableV0Integration") && options.prompt && !options.dryRun) {
      const design = await this.v0Client.generateDesign(options.prompt);
      await this.designStore.save(design);
      return design;
    }

    // Fallback: create a placeholder design from the prompt text.
    // Used in dry-run mode or when v0 integration is disabled.
    if (options.dryRun) {
      logger.info("Dry-run mode: using placeholder design");
    }
    const code = options.prompt ?? "// No design provided";
    return {
      id: `local-${Date.now()}`,
      prompt: options.prompt ?? "",
      code,
      framework: "nextjs",
      createdAt: new Date().toISOString(),
    };
  }
}
