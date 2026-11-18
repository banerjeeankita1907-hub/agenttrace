export function validateTrace(record, lineNumber = 1) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError(`line ${lineNumber}: trace must be a JSON object`);
  }
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new TypeError(`line ${lineNumber}: id must be a non-empty string`);
  }
  if (!Array.isArray(record.tool_calls) || record.tool_calls.some((tool) => typeof tool !== "string" || !tool.trim())) {
    throw new TypeError(`line ${lineNumber}: tool_calls must be an array of non-empty tool names`);
  }
  for (const field of ["required_tools", "expected_sequence", "forbidden_tools"]) {
    if (record[field] !== undefined &&
      (!Array.isArray(record[field]) || record[field].some((tool) => typeof tool !== "string" || !tool.trim()))) {
      throw new TypeError(`line ${lineNumber}: ${field} must be an array of non-empty tool names`);
    }
  }
  if (record.final_answer !== undefined && typeof record.final_answer !== "string") {
    throw new TypeError(`line ${lineNumber}: final_answer must be a string`);
  }
  return {
    id: record.id.trim(),
    tool_calls: record.tool_calls.map((tool) => tool.trim()),
    required_tools: record.required_tools?.map((tool) => tool.trim()),
    expected_sequence: record.expected_sequence?.map((tool) => tool.trim()),
    forbidden_tools: record.forbidden_tools?.map((tool) => tool.trim()),
    final_answer: record.final_answer ?? "",
  };
}

function check(name, applicable, passed, detail) {
  return { name, applicable, passed: applicable ? Boolean(passed) : null, detail };
}

export function evaluateTrace(rawRecord, lineNumber = 1) {
  const trace = validateTrace(rawRecord, lineNumber);
  const used = trace.tool_calls;
  const checks = [
    check(
      "required_tools",
      trace.required_tools !== undefined,
      trace.required_tools === undefined || trace.required_tools.every((tool) => used.includes(tool)),
      trace.required_tools === undefined
        ? "No required tool list supplied."
        : `Missing: ${trace.required_tools.filter((tool) => !used.includes(tool)).join(", ") || "none"}`,
    ),
    check(
      "tool_sequence",
      trace.expected_sequence !== undefined,
      trace.expected_sequence === undefined ||
        (used.length === trace.expected_sequence.length && used.every((tool, index) => tool === trace.expected_sequence[index])),
      trace.expected_sequence === undefined
        ? "No exact sequence supplied."
        : `Expected [${trace.expected_sequence.join(" → ")}], observed [${used.join(" → ")}].`,
    ),
    check(
      "forbidden_tools",
      trace.forbidden_tools !== undefined,
      trace.forbidden_tools === undefined || !used.some((tool) => trace.forbidden_tools.includes(tool)),
      trace.forbidden_tools === undefined
        ? "No forbidden tool list supplied."
        : `Observed forbidden: ${used.filter((tool) => trace.forbidden_tools.includes(tool)).join(", ") || "none"}`,
    ),
    check(
      "final_answer",
      true,
      trace.final_answer.trim().length > 0,
      trace.final_answer.trim() ? "A non-empty final answer was produced." : "Final answer is missing or empty.",
    ),
  ];

  const applicable = checks.filter((item) => item.applicable);
  const passed = applicable.filter((item) => item.passed).length;
  const score = Math.round((passed / applicable.length) * 100);
  return {
    id: trace.id,
    passed: passed === applicable.length,
    score,
    tool_calls: used,
    checks,
  };
}

export function parseJsonl(source) {
  if (typeof source !== "string") throw new TypeError("JSONL input must be text");
  const records = [];
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new SyntaxError(`line ${index + 1}: invalid JSON`);
    }
    records.push(evaluateTrace(value, index + 1));
  }
  if (!records.length) throw new RangeError("JSONL input contains no trace records");
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) throw new RangeError(`duplicate trace id: ${record.id}`);
    ids.add(record.id);
  }
  return records;
}

export function summarizeResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new RangeError("at least one evaluated trace is required");
  }
  const passed = results.filter((result) => result.passed).length;
  const usage = new Map();
  for (const result of results) {
    for (const tool of result.tool_calls) usage.set(tool, (usage.get(tool) || 0) + 1);
  }
  return {
    trace_count: results.length,
    passed_count: passed,
    failed_count: results.length - passed,
    pass_rate_percent: Math.round((passed / results.length) * 10000) / 100,
    average_score: Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length * 100) / 100,
    tool_usage: [...usage.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tool, calls]) => ({ tool, calls })),
  };
}
