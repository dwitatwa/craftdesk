# Best Practices

Use these rules when drafting or revising a skill.

## Start from real expertise

- Build the skill from real task execution, project documentation, repeated corrections, runbooks, schemas, config, issue history, and failure cases.
- Preserve the steps that worked, the mistakes that needed correction, the required inputs and outputs, and the project-specific constraints.
- Avoid skills synthesized from generic advice alone.

## Refine with real execution

- Treat the first draft as incomplete.
- Run the skill on realistic tasks and inspect traces, not only final output.
- Record false positives, missed cases, wasted steps, and instructions that fire in the wrong context.
- Cut weak or unnecessary instructions as aggressively as you add new ones.

## Spend context carefully

- Every token in `SKILL.md` competes with the rest of the context window.
- Keep only what the agent is likely to get wrong without the skill.
- Omit generic explanations of common concepts.

Keep content that adds:

- project-specific conventions
- tool choices
- domain-specific procedures
- non-obvious edge cases
- output constraints
- safety-critical steps

## Scope one coherent unit

- Make the skill cover one job that composes cleanly with others.
- Avoid scopes so narrow that several skills must load together.
- Avoid scopes so broad that the trigger boundary becomes fuzzy.

## Aim for moderate detail

- Prefer concise stepwise guidance with one useful example.
- Do not pack every edge case into `SKILL.md`.
- Move bulky or conditional detail into `references/`.

## Use progressive disclosure

- Keep the always-needed instructions in `SKILL.md`.
- Put detail in `references/`, `scripts/`, or `assets/`.
- Tell the agent exactly when to load each support file.

Good:

- Read `references/api-errors.md` if the API returns a non-200 response.

Bad:

- See `references/` for more details.

## Match specificity to fragility

- Use flexible guidance where multiple approaches are acceptable.
- Use prescriptive guidance where order, consistency, or safety matters.
- Explain why a rule exists when possible.

## Provide defaults, not menus

- Pick one default tool or workflow.
- Mention alternatives only as fallbacks or for clear special cases.

## Prefer procedures over one-off answers

- Teach a reusable method.
- Avoid embedding a single answer that only solves one instance.

## Add high-value structures

Use these only where they materially reduce mistakes:

- gotchas
- output templates
- checklists
- validation loops
- plan-validate-execute workflows

## Move repeated logic into scripts

- Bundle a script when the agent keeps rebuilding the same helper logic or when deterministic behavior matters.
