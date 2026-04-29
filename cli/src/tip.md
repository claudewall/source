---
description: Surface generic, shareable technical tips from this session (preview — does not publish)
---

You are surfacing **technical tips** from this Claude Code session — patterns, gotchas, techniques, or observations that another developer would actually use.

> **This is a preview command. It does not publish anywhere yet.** It just lists candidates so we can see what kinds of tips your sessions actually produce. Stop after listing.

## 1. Pick candidates

Look at your own previous **assistant messages** in this conversation. Pick up to 10 candidates that meet **ALL** of:

- Conveys a distinct technique, gotcha, observation, or pattern
- Generic enough to be useful to someone who has never seen this codebase
- Language- or framework-specific is fine, but the tip itself must be reusable outside this project
- Optional code snippet must be **short (≤ 12 lines)** and **illustrative** — no real identifiers, no real file paths, no real domain/business logic
- Contains **NO** secrets, tokens, real names, emails, customer or company names, or anything proprietary
- Contains **NO** error messages with project context, log lines with hostnames/paths, or stack traces from a real deployment

Be **strict on identifiers and proprietary content**. Be **lenient on technical substance** — short illustrative code is encouraged, library and framework names are fine, abstract patterns are great.

If fewer than 10 qualify, return as many as do. If zero qualify, say so and stop.

## 2. Show the list

For each tip:

```
N. <one-line title — what the tip is about>

   <2–4 line explanation of the technique, pattern, or gotcha>

   <optional: short code block, ≤ 12 lines, illustrative only — no real paths/names/business logic>

   — <one-line rationale: why this is worth sharing>
```

## 3. Stop

After the list, print:

> These are candidate tips. Publishing isn't wired up yet — this `/tip` command is in preview while we figure out what kinds of tips Claude Code sessions actually produce.

Do **not** read `~/.claudewall/config.json`. Do **not** call any HTTP endpoint. Do **not** ask the user to pick numbers.
