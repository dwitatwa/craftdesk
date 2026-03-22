---
name: create-skill-best-practices
description: Create or improve AI agent skills that are grounded in real project workflows, use lean SKILL.md instructions, and include strong triggering, references, scripts, and evaluation plans when needed. Use this skill when the user asks to create, update, review, or refine a skill; turn documentation, runbooks, or repeated agent workflows into a reusable skill; improve a skill description so it triggers correctly; add references or scripts to a skill; or set up evals to measure whether a skill actually helps.
---

# Create Skill Best Practices

Create skills as reusable onboarding guides for another agent, not as generic documentation dumps.

## Core workflow

1. Gather project-specific source material before writing anything.
2. For an existing skill, read the current `SKILL.md` and `agents/openai.yaml` before changing scope or wording.
3. Extract reusable workflow steps, corrections, conventions, edge cases, tool choices, and expected outputs.
4. Define one coherent unit of work for the skill.
5. Split or narrow the scope if the requested skill is trying to cover multiple loosely related jobs.
6. Initialize or update the skill folder with only the resources the skill actually needs.
7. Write a concise `SKILL.md` in imperative form that focuses on what the agent would likely get wrong without the skill.
8. Add `references/`, `scripts/`, or `assets/` only when they materially improve reliability or keep `SKILL.md` lean.
9. Write a precise frontmatter description that explains both what the skill does and when to use it.
10. Validate the skill structure and iterate using real tasks.

## Build from real expertise

- Ground the skill in real workflows, traces, runbooks, config, schemas, bug fixes, review comments, or repeated user corrections.
- Do not fill the skill with generic advice the base model already knows.
- If the source material is thin, say so and keep the scope narrow rather than inventing a broad skill.

## Keep the skill lean

- Keep `SKILL.md` to the always-needed instructions.
- Move detailed material into `references/` and tell the agent exactly when to read each file.
- Add scripts only when the same logic is repeatedly reinvented or the task needs deterministic execution.
- If a script is added, list it in `SKILL.md` with a relative invocation command and a short purpose.
- Delete empty or unused resource directories and placeholder files left by scaffolding.
- Do not create extra documentation files such as `README.md`, `CHANGELOG.md`, or process notes inside the skill.

## Write the frontmatter description carefully

- Write the description in imperative form.
- Describe user intent, not the implementation details of the skill.
- Include adjacent trigger cases where the user may describe the need indirectly.
- Keep triggering information in the frontmatter description, not in a "when to use" section in the body.
- Read `references/description-optimization.md` when the description needs to be drafted or improved.

## Choose resources intentionally

- Read `references/best-practices.md` before drafting `SKILL.md`.
- Read `references/using-scripts.md` before adding `scripts/`.
- Read `references/evaluating-skills.md` when the user wants the skill tested, benchmarked, or improved systematically.
- Add an `evals/` directory only when the user wants systematic quality checks, and include realistic prompts, files, and fixtures needed to run the workflow.
- Keep references one level deep from `SKILL.md`. Do not create nested reference chains.

## Required output for a new skill

Produce:

- `SKILL.md`
- `agents/openai.yaml`
- only the resource directories the skill actually needs

Ensure `agents/openai.yaml` includes:

- a human-facing `display_name`
- a concise `short_description`
- a `default_prompt` that explicitly mentions `$skill-name`
- values that still match the final skill after editing

## Validation and iteration

1. Validate the finished skill with the available validator.
2. Fix any frontmatter, naming, or structure issues.
3. If the skill includes scripts, run `--help` and at least one representative command to confirm the interface and output are usable.
4. If the skill includes `evals/` or grading workflows, run at least one representative end-to-end eval command and inspect the generated artifacts.
5. Forward-test the skill on realistic requests if the workflow is non-trivial.
6. Tighten or remove instructions that cause wasted work.
7. Add gotchas, templates, validators, scripts, or eval fixtures only where failures show they are needed.

## Drafting checklist

- Is the skill based on real project knowledge?
- Is the scope one coherent unit of work?
- Does each section teach something the agent would otherwise miss?
- Is the description specific enough to trigger correctly without broad false positives?
- Are defaults clear?
- Are fragile steps explicit?
- Are bulky details deferred into references with explicit load conditions?
- Are evals planned when output quality matters?
