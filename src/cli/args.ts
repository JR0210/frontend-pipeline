import { Command, Option } from "commander";
import type { CLIOptions } from "../types/index.js";

/**
 * Builds and returns the CLI program using Commander.
 * Parsing is handled separately so the program can be tested without
 * triggering process.exit.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("frontend-pipeline")
    .description(
      "CLI-driven pipeline that converts Vercel v0 outputs into " +
        "structured React/Next.js components"
    )
    .version("0.1.0");

  program
    .command("generate", { isDefault: true })
    .description("Run the full generation pipeline")
    .option("-p, --prompt <text>", "Natural language prompt to send to Vercel v0")
    .option("-n, --feature-name <name>", "Name of the feature/component to generate")
    .option("-o, --output-dir <dir>", "Base output directory", "temp/dist")
    .option("-d, --design-file <path>", "Load a saved v0 design from a JSON file instead of calling the API")
    .option("-u, --design-url <url>", "Fetch the latest code from an existing v0.app chat URL")
    .addOption(new Option("-f, --framework <nextjs|react>", "Target framework for generated components").choices(["nextjs", "react"]).default("nextjs"))
    .option("--skip-validation", "Skip the design validation phase", false)
    .option("--skip-tests", "Skip test generation", false)
    .option("--skip-skills", "Skip applying repository skills", false)
    .option("--dry-run", "Print what would be generated without writing files", false)
    .option("-v, --verbose", "Enable verbose / debug logging", false)
    .action(async (opts: Record<string, unknown>) => {
      const { runPipeline } = await import("./runner.js");
      const { promptMissingOptions } = await import("./promptUser.js");
      const options = await promptMissingOptions(mapOptions(opts));
      await runPipeline(options);
    });

  program
    .command("list-designs")
    .description("List locally stored v0 designs")
    .action(async () => {
      const { listDesigns } = await import("./runner.js");
      await listDesigns();
    });

  program
    .command("list-chats")
    .description("List your v0 chats from the API (requires V0_API_KEY)")
    .action(async () => {
      const { listV0Chats } = await import("./runner.js");
      await listV0Chats();
    });

  return program;
}

function mapOptions(opts: Record<string, unknown>): CLIOptions {
  return {
    prompt: opts["prompt"] as string | undefined,
    featureName: opts["featureName"] as string | undefined,
    outputDir: opts["outputDir"] as string | undefined,
    designFile: opts["designFile"] as string | undefined,
    designUrl: opts["designUrl"] as string | undefined,
    framework: (opts["framework"] as "nextjs" | "react" | undefined) ?? "nextjs",
    skipValidation: Boolean(opts["skipValidation"]),
    skipTests: Boolean(opts["skipTests"]),
    skipSkills: Boolean(opts["skipSkills"]),
    verbose: Boolean(opts["verbose"]),
    dryRun: Boolean(opts["dryRun"]),
  };
}
