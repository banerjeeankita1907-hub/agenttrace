import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "src/agenttrace/cli.js");

test("CLI prints a JSON report for the sample traces", () => {
  const result = spawnSync(process.execPath, [cli, resolve(root, "fixtures/sample-traces.jsonl")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.trace_count, 3);
  assert.equal(output.summary.failed_count, 0);
});

test("CLI returns a nonzero code for missing arguments", () => {
  const result = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
