#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJsonl, summarizeResults } from "./core.js";

function usage() {
  return [
    "Usage: agenttrace <traces.jsonl> [--pretty]",
    "",
    "Evaluate tool-use traces against required tools, exact sequences,",
    "forbidden tools, and a non-empty final answer.",
  ].join("\n");
}

async function main(argv) {
  const [file, ...flags] = argv;
  if (!file || flags.some((flag) => flag !== "--pretty")) {
    process.stderr.write(usage() + "\n");
    return 2;
  }
  try {
    const input = await readFile(resolve(file), "utf8");
    const results = parseJsonl(input);
    const report = { summary: summarizeResults(results), results };
    process.stdout.write(JSON.stringify(report, null, flags.includes("--pretty") ? 2 : 0) + "\n");
    return report.summary.failed_count === 0 ? 0 : 1;
  } catch (error) {
    process.stderr.write(`agenttrace: ${error.message}\n`);
    return 2;
  }
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
