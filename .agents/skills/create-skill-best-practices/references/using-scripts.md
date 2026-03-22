# Using Scripts

Use this guide before adding executable helpers to a skill.

## Decide between a one-off command and a bundled script

Use a one-off command when:

- an existing tool already solves the problem
- the command is short and stable
- runtime dependency resolution is acceptable

Common runners:

- `uvx`
- `pipx`
- `npx`
- `bunx`
- `deno run`
- `go run`

Rules:

- pin versions
- state prerequisites in `SKILL.md`
- move complex commands into scripts

## Reference scripts with relative paths

List scripts in `SKILL.md` and invoke them relative to the skill root.

Example:

```md
## Available scripts

- `scripts/validate.sh` - validate configuration files
- `scripts/process.py` - process input data
```

```bash
bash scripts/validate.sh "$INPUT_FILE"
python3 scripts/process.py --input results.json
```

## Prefer self-contained scripts

When possible, use inline dependency metadata so the agent can run the script directly.

Python example:

```python
# /// script
# dependencies = [
#   "beautifulsoup4>=4.12,<5",
# ]
# requires-python = ">=3.11"
# ///
```

## Design scripts for agents

Agents run in non-interactive shells.

Requirements:

- never require TTY prompts
- accept input via flags, environment variables, or stdin
- fail fast with clear guidance when required input is missing

## `--help` guidance

Provide concise `--help` output with:

- purpose
- usage
- flags
- defaults
- short examples

## Error-message guidance

Error messages should say:

- what failed
- what was expected
- what value was received, if relevant
- what to try next

## Output guidance

- write structured data to stdout
- write logs and diagnostics to stderr
- prefer JSON, CSV, or TSV over free-form text

## Safety and reliability

- make retries safe where possible
- reject ambiguous input rather than guessing
- add `--dry-run` for destructive or stateful work
- use meaningful exit codes
- require explicit confirmation flags for risky actions when appropriate
- avoid massive stdout dumps; prefer summaries or output files

## When a script is justified

Bundle a script when:

- the agent keeps recreating the same helper logic
- quoting or flag handling is error-prone
- deterministic validation is needed
- the workflow benefits from stable, repeatable behavior
