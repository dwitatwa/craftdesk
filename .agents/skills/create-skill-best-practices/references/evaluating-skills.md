# Evaluating Skills

Use this guide when the user wants to test whether a skill improves output quality.

## Eval design

Each test case should include:

- `prompt`
- `expected_output`
- optional `files`
- `assertions` after the first run

Start with 2 to 3 realistic test cases, then expand.

## `evals/evals.json` shape

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic task prompt",
      "expected_output": "Human-readable success criteria",
      "files": ["evals/files/input.dat"],
      "assertions": [
        "Specific, observable, verifiable condition"
      ]
    }
  ]
}
```

## Compare against a baseline

Run each eval with:

- the current skill
- no skill, or the previous skill version

Keep runs isolated with fresh sessions or subagents.

## Workspace structure

Use an iteration-based workspace such as:

```text
my-skill-workspace/
└── iteration-1/
    ├── eval-case-a/
    │   ├── with_skill/
    │   │   ├── outputs/
    │   │   ├── timing.json
    │   │   └── grading.json
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    └── benchmark.json
```

## Capture cost

Save timing and token usage for each run:

```json
{
  "total_tokens": 12345,
  "duration_ms": 23456
}
```

## Write good assertions

Good assertions are:

- specific
- observable
- verifiable
- not brittle to wording changes

Examples:

- The output file is valid JSON.
- The chart has labeled axes.
- The report includes at least 3 recommendations.

## Grade with evidence

For each assertion:

- mark pass or fail
- record concrete evidence

Prefer scripts for mechanical checks such as:

- file existence
- row counts
- schema validation
- dimensions
- JSON validity

Use an LLM judge for qualitative checks with clear criteria.

## Aggregate and analyze

Summarize:

- pass rate
- mean tokens
- mean duration
- delta vs baseline

Inspect:

- assertions that always pass in both configs
- assertions that always fail in both configs
- assertions that pass only with the skill
- flaky evals with inconsistent outcomes

Read traces for time and token outliers.

## Add human review

Review the actual outputs and save concrete, actionable feedback. Use it to catch issues that assertions missed.

## Iteration loop

1. Run all evals.
2. Grade with evidence.
3. Aggregate metrics.
4. Review outputs as a human.
5. Give the current `SKILL.md`, failed assertions, feedback, and traces to an LLM.
6. Ask for broad improvements, not prompt-specific patches.
7. Re-run in a new iteration directory.

Stop when the skill is good enough and additional changes no longer produce meaningful gains.
