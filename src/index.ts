#!/usr/bin/env node
import "dotenv/config";
import { buildProgram } from "./cli/args.js";

const program = buildProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
