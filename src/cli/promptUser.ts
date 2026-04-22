import type { CLIOptions } from "../types/index.js";

export async function promptMissingOptions(options: CLIOptions): Promise<CLIOptions> {
  const result = { ...options };

  // ── Non-TTY fast path ─────────────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    const missing: string[] = [];

    if (!result.featureName) {
      missing.push("  --feature-name  Name of the feature/component to generate");
    }
    if (!result.prompt && !result.designUrl && !result.designFile) {
      missing.push(
        "  --prompt        Natural language prompt (or provide --design-url / --design-file)"
      );
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required options for non-interactive mode:\n${missing.join("\n")}`
      );
    }

    result.outputDir ??= "temp/dist";
    result.framework ??= "nextjs";
    return result;
  }

  // ── TTY interactive path ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Input, Select, MultiSelect, Confirm } = (await import("enquirer")).default as any;

  // ── 1. Source: API prompt vs chat URL vs design file ─────────────────────
  if (!result.prompt && !result.designFile && !result.designUrl) {
    const sourcePrompt = new Select({
      name: "source",
      message: "How do you want to provide the design?",
      choices: [
        { name: "api", message: "Generate new design via Vercel v0 API (requires V0_API_KEY)" },
        { name: "url", message: "Load from an existing v0.app chat URL (requires V0_API_KEY)" },
        { name: "file", message: "Load from a saved local design file (--design-file)" },
      ],
    });

    const source: string = await sourcePrompt.run();

    if (source === "url") {
      const urlInput = new Input({
        name: "designUrl",
        message: "v0.app chat URL or chat ID:",
        hint: "e.g. https://v0.app/chat/my-design-abc123",
        validate: (v: string) => v.trim().length > 0 || "URL cannot be empty",
      });
      result.designUrl = await urlInput.run();
    } else if (source === "file") {
      const filePrompt = new Input({
        name: "designFile",
        message: "Path to design JSON file:",
        validate: (v: string) => v.trim().length > 0 || "Path cannot be empty",
      });
      result.designFile = await filePrompt.run();
    }
  }

  // ── 2. Prompt text (only when generating a new design via API) ───────────
  if (!result.designFile && !result.designUrl && !result.prompt) {
    const promptInput = new Input({
      name: "prompt",
      message: "Describe the component/feature to generate:",
      validate: (v: string) => v.trim().length > 0 || "Prompt cannot be empty",
    });
    result.prompt = await promptInput.run();
  }

  // ── 3. Feature name ───────────────────────────────────────────────────────
  if (!result.featureName) {
    const nameInput = new Input({
      name: "featureName",
      message: "Feature / component name:",
      initial: "my-feature",
    });
    result.featureName = await nameInput.run();
  }

  // ── 4. Output directory ───────────────────────────────────────────────────
  if (!result.outputDir) {
    const outInput = new Input({
      name: "outputDir",
      message: "Output directory:",
      initial: "temp/dist",
    });
    result.outputDir = await outInput.run();
  }

  // ── 5. Framework ──────────────────────────────────────────────────────────
  if (!result.framework) {
    const frameworkSelect = new Select({
      name: "framework",
      message: "Target framework:",
      choices: [
        { name: "nextjs", message: "Next.js (App Router)" },
        { name: "react", message: "React" },
      ],
    });
    result.framework = await frameworkSelect.run();
  }

  // ── 6. Pipeline options ───────────────────────────────────────────────────
  const explicitFlags =
    result.skipValidation || result.skipTests || result.skipSkills || result.dryRun;

  if (!explicitFlags) {
    const optionsSelect = new MultiSelect({
      name: "pipelineOptions",
      message: "Pipeline options: (space to toggle, enter to confirm)",
      choices: [
        { name: "dryRun", message: "Dry run (preview only, no files written)" },
        { name: "skipValidation", message: "Skip validation" },
        { name: "skipTests", message: "Skip test generation" },
        { name: "skipSkills", message: "Skip skills engine" },
      ],
    });

    let selected: string[] = [];
    try {
      selected = await optionsSelect.run();
    } catch {
      // user pressed escape — treat as no options selected
    }

    result.dryRun = result.dryRun || selected.includes("dryRun");
    result.skipValidation = result.skipValidation || selected.includes("skipValidation");
    result.skipTests = result.skipTests || selected.includes("skipTests");
    result.skipSkills = result.skipSkills || selected.includes("skipSkills");
  }

  // ── 7. Verbose confirmation ───────────────────────────────────────────────
  if (!result.verbose) {
    const verboseConfirm = new Confirm({
      name: "verbose",
      message: "Enable verbose logging?",
      initial: false,
    });
    result.verbose = await verboseConfirm.run();
  }

  return result;
}
