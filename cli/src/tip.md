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

## 2. Format each tip

For each candidate, output **exactly** this structure. The number appears **once**, in the `###` heading. Do **not** repeat the number on the explanation, code, tags, or rationale lines. Separate consecutive tips with a `---` line.

```
### Tip N — <one-line title>

<2–4 plain sentences explaining the technique, pattern, or gotcha. No leading number or bullet.>

<optional fenced code block, ≤ 12 lines, illustrative only — no real paths/names/business logic>

**Tags:** <comma-separated list of 2–5 tags>

**Why share:** <one-line rationale>

---
```

### Tag rules

- 2–5 tags per tip
- All lowercase
- Multi-word tags use hyphens (e.g. `time-series`, `react-hooks`, `unit-tests`)
- Prefer well-known nouns: language, runtime, library, framework, database, domain concept
- Examples of good tags: `python`, `javascript`, `typescript`, `react`, `mongodb`, `postgres`, `redis`, `pytest`, `async`, `aggregation`, `caching`, `observability`, `oauth`, `dashboards`, `time-series`, `testing`, `error-handling`
- Avoid project-specific or company-specific tags
- Don't invent overly narrow tags — `python-datetime` is worse than `python` + `datetime`

A correctly-formatted tip looks like this:

```
### Tip 1 — Always close async generators in finally blocks

If a consumer breaks out of an async-for early, the generator's
finally block doesn't run unless you explicitly aclose() it. The
classic symptom is a connection or file handle that "leaks" only
on the error path.

```python
gen = stream_rows()
try:
    async for row in gen:
        if row.bad: break
finally:
    await gen.aclose()
```

**Tags:** python, async, generators, resource-management

**Why share:** Cleanup correctness on the early-exit path is rarely covered by tests.

---
```

## 3. Stop

After the last tip, print exactly:

> These are candidate tips. Publishing isn't wired up yet — this `/tip` command is in preview while we figure out what kinds of tips Claude Code sessions actually produce.

Do **not** read `~/.claudewall/config.json`. Do **not** call any HTTP endpoint. Do **not** ask the user to pick numbers.
