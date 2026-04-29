---
description: Pick technical tips from this session and publish them to claudewall.com/tips
---

You are surfacing **technical tips** from this Claude Code session — patterns, gotchas, techniques, or observations another developer would actually use — for **claudewall.com/tips**.

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

Output **exactly** this structure for each candidate. The number appears **once**, in the `###` heading. Separate consecutive tips with a `---` line.

```
### Tip N — <one-line title>

<2–4 plain sentences explaining the technique, pattern, or gotcha.>

<optional fenced code block, ≤ 12 lines, illustrative only>

**Tags:** <2–5 tags>

**Why share:** <one-line rationale>

---
```

### Tag rules

- 2–5 tags per tip
- All lowercase, hyphenated for multi-word (`time-series`, `react-hooks`, `unit-tests`)
- Match `^[a-z0-9][a-z0-9-]*$` (the API rejects anything else)
- Prefer well-known nouns: language, runtime, library, framework, database, domain concept
- Examples: `python`, `javascript`, `typescript`, `react`, `mongodb`, `postgres`, `pytest`, `async`, `aggregation`, `caching`, `oauth`, `dashboards`, `time-series`
- Don't invent overly narrow tags — `python` + `datetime` beats `python-datetime`
- No project- or company-specific tokens

After the list, ask the user:

> Reply with the numbers to publish (e.g. `2, 5, 7`), `all`, or `none`.

Wait for the user's reply.

## 3. Publish

If the user replied `none`, stop.

For **each** chosen tip:

**a. Write the JSON body** with the **Write** tool to a UTF-8 file at an absolute path:

- macOS / Linux: `~/.claudewall/.submit.json` resolved to absolute (e.g. `/Users/<you>/.claudewall/.submit.json`)
- Windows: `C:\Users\<you>\.claudewall\.submit.json`

Valid JSON object, properly escape `"` and `\` inside string values:

```
{
  "title": "<the title from the heading>",
  "body": "<the 2-4 sentence explanation>",
  "code": "<the code block contents, exactly>",
  "lang": "<language hint matching the code, e.g. python, javascript, typescript, sql, bash>",
  "tags": ["tag1", "tag2", "tag3"],
  "model": "<your model id if known>"
}
```

- Omit `code` and `lang` entirely if the tip has no code block
- Omit `model` if you don't know your model id
- `tags` must be an array of 1–5 lowercase strings matching `^[a-z0-9][a-z0-9-]*$`

**Code-snippet hygiene:** if your code contains `$`-prefixed shell-style variables (e.g. `$BRAND`, `${TOKEN}`), security scanners may flag them as credentials and block the Write. Replace with bracketed placeholders like `<BRAND>` or `[TOKEN]`, or wrap in single quotes to disambiguate. Also strip any literal `Bearer …` strings, real-looking API keys, or anything that pattern-matches as a secret.

**b. Publish** via the **Bash** tool:

```
npx claudewall publish tip <absolute-path-to-.submit.json>
```

This binary loads the auth token from `~/.claudewall/config.json` at runtime — **do not** add an `Authorization` header, **do not** invoke `curl` directly, **do not** read or print the token anywhere. On success, it prints **just the URL** of the published tip on stdout. Print that URL to the user.

On failure the binary exits non-zero with the reason on stderr. If it says to run `npx claudewall init`, tell the user to do that and stop. Otherwise show the error and continue with the next tip.

**c. After all submissions**, delete the temp file via **Bash**:

```
rm <absolute-path>
```

(Windows: `del "<path>"`.)
