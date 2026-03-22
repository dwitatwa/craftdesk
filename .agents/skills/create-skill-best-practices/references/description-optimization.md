# Description Optimization

Use this guide when drafting or improving the `description` field in a skill's frontmatter.

## Description rules

- Write in imperative form: `Use this skill when...`
- Describe the user's intent and job to be done.
- Mention relevant file types, domains, workflows, and outputs.
- Include indirect trigger cases where the user may describe the need without naming the domain.
- Clarify nearby task boundaries when false triggers are likely.
- Keep the final description under 1024 characters.

## Working template

```yaml
description: >
  Use this skill when the user needs to [primary outcome] for
  [relevant inputs, domains, or workflows]. It supports tasks such as
  [task family A], [task family B], and [task family C], including
  cases where the user describes the need indirectly instead of naming
  the exact domain. Do not use it for [nearby but different task].
```

## Trigger eval set

Build about 20 labeled prompts:

- 8 to 10 `should_trigger`
- 8 to 10 `should_not_trigger`

Vary:

- formal and casual phrasing
- explicit and implicit domain mentions
- short and context-heavy prompts
- simple and multi-step tasks
- realistic typos and abbreviations

Include realistic context such as:

- file paths
- user or business context
- concrete field names and formats

Use near-miss negatives, not obviously unrelated prompts.

## Trigger-rate evaluation

- Run each query multiple times. Three runs is a reasonable default.
- Record whether the skill triggered on each run.
- Compute the trigger rate.

Default thresholds:

- `should_trigger`: pass above `0.5`
- `should_not_trigger`: pass below `0.5`

## Avoid overfitting

- Split the eval set into train and validation sets.
- Use only train failures to guide revisions.
- Keep the validation set fixed and hidden from the revision loop.
- Revise at the concept level, not by copying keywords from failed queries.

## Revision guidance

If `should_trigger` cases fail:

- broaden the task framing
- add clearer intent cues

If `should_not_trigger` cases fail:

- tighten the boundary
- state what the skill does not cover

If iteration stalls:

- try a different description structure instead of minor word tweaks

## Final checks

- stays under 1024 characters
- passes manual sanity checks
- performs well on fresh prompts not used during optimization
