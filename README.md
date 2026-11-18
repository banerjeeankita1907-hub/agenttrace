# AgentTrace

An offline evaluation harness for tool-using AI agent traces. Feed it JSON Lines (JSONL) records and it checks whether each run used required tools, followed an expected sequence, avoided forbidden tools, and produced a final answer.

> AgentTrace evaluates recorded traces against explicit rules. It does not execute agents, call model APIs, or prove that a tool result or final answer is factually correct.

## Features

- JSONL input with line-numbered validation errors.
- Required-tool, exact-sequence, forbidden-tool, and final-answer checks.
- Per-trace pass/fail and transparent score breakdown.
- Aggregate pass rate, average score, and tool usage counts.
- CLI exit code 1 when one or more traces fail (useful in CI).
- No runtime dependencies or API keys.

## Run it

Requires Node.js 20+.

```bash
git clone https://github.com/banerjeeankita1907-hub/ANAI.git
cd ANAI
npm test
npm run check
npm run sample
```

Evaluate your own run log:

```bash
node src/agenttrace/cli.js path/to/traces.jsonl --pretty
```

## JSONL contract

Each non-empty line is one trace:

```json
{
  "id": "weather-success",
  "tool_calls": ["weather_lookup", "format_response"],
  "required_tools": ["weather_lookup"],
  "expected_sequence": ["weather_lookup", "format_response"],
  "forbidden_tools": ["delete_user"],
  "final_answer": "It will be sunny."
}
```

- `id` and `tool_calls` are required.
- `required_tools`, `expected_sequence`, and `forbidden_tools` are optional; checks without a supplied rule are marked not applicable and do not affect the score.
- `final_answer` is always checked and must be non-empty.
- Duplicate IDs and malformed JSON lines fail input validation.

## Scoring

Each applicable check contributes equally to a trace's score. A trace passes only when every applicable check passes. Aggregate pass rate counts fully passing traces; average score preserves partial credit. This makes failures inspectable rather than hiding them behind one opaque metric.

## CI integration

The GitHub Actions workflow runs the unit tests and evaluates the sample traces on pushes and pull requests. In a larger agent project, run AgentTrace on sanitized traces captured from staging or evaluation fixtures.

## Privacy

AgentTrace runs locally and does not upload trace files. Logs can include prompts, user content, or secrets in tool arguments; sanitize traces before storing them in a repository or CI artifacts.

## Project layout

```text
src/agenttrace/       Evaluation library and CLI
tests/                Unit and CLI tests
fixtures/              Synthetic examples
.github/workflows/     CI
```

## License

MIT.
