import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrace, parseJsonl, summarizeResults, validateTrace } from "../src/agenttrace/core.js";

test("passes a trace matching required tools, exact order, and final output", () => {
  const result = evaluateTrace({
    id: "weather-happy-path",
    tool_calls: ["weather_lookup", "format_response"],
    required_tools: ["weather_lookup"],
    expected_sequence: ["weather_lookup", "format_response"],
    forbidden_tools: ["delete_account"],
    final_answer: "It will be sunny.",
  });
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test("fails missing required tools and forbidden tool use", () => {
  const result = evaluateTrace({
    id: "unsafe-trace",
    tool_calls: ["delete_account"],
    required_tools: ["weather_lookup"],
    forbidden_tools: ["delete_account"],
    final_answer: "",
  });
  assert.equal(result.passed, false);
  assert.equal(result.score, 0);
  assert.equal(result.checks.find((item) => item.name === "forbidden_tools").passed, false);
});

test("only scores checks that are explicitly applicable", () => {
  const result = evaluateTrace({ id: "minimal", tool_calls: [], final_answer: "I cannot help with that request." });
  assert.equal(result.score, 100);
  assert.equal(result.checks.filter((item) => item.applicable).length, 1);
});

test("validates record field types", () => {
  assert.throws(() => validateTrace(null), /JSON object/);
  assert.throws(() => validateTrace({ id: "", tool_calls: [] }), /id/);
  assert.throws(() => validateTrace({ id: "x", tool_calls: ["", 3] }), /tool_calls/);
  assert.throws(() => validateTrace({ id: "x", tool_calls: [], required_tools: "tool" }), /required_tools/);
  assert.throws(() => validateTrace({ id: "x", tool_calls: [], final_answer: 4 }), /final_answer/);
});

test("parses JSONL, ignores blank lines, and reports line numbers", () => {
  const results = parseJsonl([
    JSON.stringify({ id: "one", tool_calls: [], final_answer: "done" }),
    "",
    JSON.stringify({ id: "two", tool_calls: ["search"], final_answer: "found" }),
  ].join("\n"));
  assert.equal(results.length, 2);
  assert.throws(() => parseJsonl('{"id": "ok", "tool_calls": [], "final_answer": "yes"}\n{bad'), /line 2/);
  assert.throws(() => parseJsonl("  \n"), /no trace records/);
});

test("rejects duplicate trace IDs", () => {
  const record = JSON.stringify({ id: "same", tool_calls: [], final_answer: "done" });
  assert.throws(() => parseJsonl(record + "\n" + record), /duplicate trace id/);
});

test("summarizes pass rate, average score, and tool usage", () => {
  const results = [
    evaluateTrace({ id: "a", tool_calls: ["search", "summarize"], final_answer: "done" }),
    evaluateTrace({ id: "b", tool_calls: ["search"], final_answer: "" }),
  ];
  const summary = summarizeResults(results);
  assert.equal(summary.trace_count, 2);
  assert.equal(summary.passed_count, 1);
  assert.equal(summary.failed_count, 1);
  assert.equal(summary.pass_rate_percent, 50);
  assert.deepEqual(summary.tool_usage, [{ tool: "search", calls: 2 }, { tool: "summarize", calls: 1 }]);
  assert.throws(() => summarizeResults([]), /at least one/);
});
