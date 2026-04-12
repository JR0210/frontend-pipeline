import chalk from "chalk";
import ora from "ora";
import type { CLIOptions, PipelineOutput } from "../types/index.js";
import { Pipeline } from "../pipeline/index.js";
import { DesignStore } from "../pipeline/designStore.js";
import { initLogger, logger } from "../observability/logger.js";
import { resolveFlags } from "../observability/flags.js";
import { errorTracker } from "../observability/errorTracker.js";

/**
 * Top-level runner invoked by the CLI action handlers.
 * Manages progress spinners, logging initialisation, and error presentation.
 */
export async function runPipeline(options: CLIOptions): Promise<void> {
  const flags = resolveFlags({
    enableStructuredLogging: process.env["NODE_ENV"] === "production",
  });

  initLogger(options.verbose ? "debug" : "info", flags.enableStructuredLogging);

  const spinner = ora({ text: "Initialising pipeline…", color: "cyan" });

  try {
    if (!options.dryRun) spinner.start();

    logger.info("frontend-pipeline starting", { featureName: options.featureName ?? "my-feature" });

    const pipeline = new Pipeline();
    spinner.text = "Running pipeline…";
    const output = await pipeline.run(options, flags);

    spinner.succeed(chalk.green("Pipeline complete!"));
    printSummary(output);
  } catch (err) {
    spinner.fail(chalk.red("Pipeline failed"));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\nError: ${message}`));

    if (errorTracker.hasErrors()) {
      console.error(chalk.yellow("\nCaptured errors:"));
      for (const e of errorTracker.getErrors()) {
        console.error(chalk.yellow(`  [${e.code}] ${e.message}`));
      }
    }

    process.exit(1);
  }
}

export async function listDesigns(): Promise<void> {
  const store = new DesignStore();
  const ids = await store.list();

  if (ids.length === 0) {
    console.log(chalk.yellow("No saved designs found."));
    return;
  }

  console.log(chalk.bold("\nSaved designs:"));
  for (const id of ids) {
    console.log(`  ${chalk.cyan("•")} ${id}`);
  }
}

function printSummary(output: PipelineOutput): void {
  console.log(chalk.bold("\nGenerated:"));
  console.log(`  ${chalk.cyan("Output dir:")} ${output.outputDir}`);
  console.log(`  ${chalk.cyan("Components:")} ${output.components.length}`);
  console.log(`  ${chalk.cyan("Hooks:")}      ${output.hooks.length}`);
  console.log(`  ${chalk.cyan("Tests:")}      ${output.tests.length}`);

  if (output.components.length > 0) {
    console.log(chalk.bold("\nComponents:"));
    for (const c of output.components) {
      const tag = c.isClientComponent ? chalk.yellow("[client]") : chalk.green("[server]");
      console.log(`  ${tag} ${chalk.white(c.name)}`);
    }
  }
}
