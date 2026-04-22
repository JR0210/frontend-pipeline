import chalk from "chalk";
import ora from "ora";
import type { CLIOptions, PipelineOutput } from "../types/index.js";
import { Pipeline } from "../pipeline/index.js";
import { DesignStore } from "../pipeline/designStore.js";
import { V0ChatFetcher } from "../pipeline/v0ChatFetcher.js";
import { initLogger, logger } from "../observability/logger.js";
import { resolveFlags } from "../observability/flags.js";
import { errorTracker } from "../observability/errorTracker.js";

/**
 * Top-level runner invoked by the CLI action handlers.
 * Manages progress spinners, logging initialisation, and error presentation.
 */
export async function runPipeline(options: CLIOptions): Promise<void> {
  const flags = resolveFlags();

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

export async function listV0Chats(): Promise<void> {
  const fetcher = new V0ChatFetcher();
  let chats;
  try {
    chats = await fetcher.listChats();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\nError: ${message}`));
    process.exit(1);
  }

  if (chats.length === 0) {
    console.log(chalk.yellow("No v0 chats found for this API key."));
    return;
  }

  console.log(chalk.bold(`\nYour v0 chats (${chats.length} total):`));
  for (const chat of chats) {
    const title = chat.title ? chalk.white(chat.title) : chalk.gray("(untitled)");
    const date = chat.updatedAt
      ? chalk.gray(new Date(chat.updatedAt).toLocaleDateString())
      : "";
    console.log(`  ${chalk.cyan("•")} ${title}`);
    console.log(`    ${chalk.dim("ID:")}  ${chalk.yellow(chat.id)}`);
    if (chat.url) console.log(`    ${chalk.dim("URL:")} ${chat.url}`);
    if (date) console.log(`    ${chalk.dim("Updated:")} ${date}`);
    console.log();
  }
  console.log(chalk.dim("Use the ID or URL with: npm run dev -- generate -u <url-or-id>"));
}

function printSummary(output: PipelineOutput): void {
  console.log(chalk.bold("\nGenerated:"));
  console.log(`  ${chalk.cyan("Output dir:")} ${output.outputDir}`);
  console.log(`  ${chalk.cyan("Components:")} ${output.components.length}`);
  console.log(`  ${chalk.cyan("Hooks:")}      ${output.hooks.length}`);
  console.log(`  ${chalk.cyan("Tests:")}      ${output.tests.length}`);
  if (output.errorBoundaryFile) {
    console.log(`  ${chalk.cyan("Error boundary:")} ${output.errorBoundaryFile}`);
    console.log(chalk.dim("  (Place error.tsx at the appropriate Next.js App Router route segment)"));
  }

  if (output.components.length > 0) {
    console.log(chalk.bold("\nComponents:"));
    for (const c of output.components) {
      const tag = c.isClientComponent ? chalk.yellow("[client]") : chalk.green("[server]");
      console.log(`  ${tag} ${chalk.white(c.name)}`);
    }
  }

  const deps = output.externalDependencies ?? [];
  if (deps.length > 0) {
    const packages = [...new Set(deps.map((d) => d.package))];
    const npmPackages = [
      ...new Set(
        packages
          .filter((p) => !p.startsWith("@/"))
          .map((p) => (p.startsWith("@") ? p.split("/").slice(0, 2).join("/") : p.split("/")[0])),
      ),
    ];

    console.log(chalk.bold(chalk.yellow("\n⚠  Peer dependencies required in target project:")));
    for (const dep of deps) {
      console.log(
        `  ${chalk.yellow("•")} ${chalk.white(dep.package)}  ${chalk.dim(`(${dep.symbols.join(", ")})`)}  ${chalk.dim(`← ${dep.sourceFile}`)}`,
      );
    }

    if (npmPackages.length > 0) {
      console.log(chalk.cyan(`\n  npm install ${npmPackages.join(" ")}`));
    }
  }
}
