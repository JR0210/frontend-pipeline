import type { CLIOptions } from "../types/index.js";

/**
 * Fills any missing CLIOptions interactively using enquirer prompts.
 * Options already supplied via flags are left untouched.
 */
export async function promptMissingOptions(options: CLIOptions): Promise<CLIOptions> {
  // enquirer is a CJS module; named prompt classes live on the default export at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Input, Select, MultiSelect, Confirm } = (await import("enquirer")).default as any;

  const result = { ...options };

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
  const featureDefault = "my-feature";
  if (!result.featureName || result.featureName === featureDefault) {
    const nameInput = new Input({
      name: "featureName",
      message: "Feature / component name:",
      initial: result.featureName ?? featureDefault,
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

  // ── 5. Pipeline options (multiselect, skip if all were explicitly set) ────
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

    // MultiSelect returns [] on enter with nothing selected — that's fine
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

  // ── 6. Verbose confirmation ───────────────────────────────────────────────
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
