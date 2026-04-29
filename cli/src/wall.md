---
description: Pick up to 10 memorable quotes from this session and publish them to claudewall.com
---

You are extracting quotes for **claudewall.com** — a public wall of memorable lines from Claude Code sessions.

## 1. Pick candidates

Look at your own previous **assistant messages** in this conversation. Pick up to 10 candidate quotes that meet **ALL** of:

- Reads as a standalone aphorism — would make sense to a stranger with no context
- Pithy or surprising — an insight, an observation, or a self-aware/meta line
- Between 10 and 280 characters
- Contains **NO** code, file paths, function or variable names, identifiers, project specifics, business context, dates, URLs, or anything that hints at session-specific subject matter
- Contains **NO** secrets, tokens, names, emails, or other identifying data

Be **strict**. If fewer than 10 qualify, return as many as do. If zero qualify, say so and stop.

## 2. Show the list

Present a numbered list. For each quote include:

```
N. "<the quote>"
   — <one-line rationale: why it's memorable>
```

Then ask the user:

> Reply with the numbers to publish (e.g. `3, 7, 9`), `all`, or `none`.

Wait for the user's reply.

## 3. Publish

If the user replied `none`, stop.

For **each** chosen quote, run **one** Bash invocation that pipes the JSON body to the publisher via a heredoc — no temp file, no extra Write step:

```
npx claudewall@latest publish quote <<'EOF'
{"quote":"<the quote>","model":"<your model id>","rationale":"<one line>"}
EOF
```

- The single-quoted `'EOF'` delimiter prevents shell variable expansion — the JSON content is sent verbatim
- Properly escape `"` and `\` in JSON string values
- Omit the `"model"` field entirely if you don't know your model id
- The binary loads the auth token from `~/.claudewall/config.json` at runtime — **do not** add an `Authorization` header, **do not** invoke `curl` directly, **do not** read or print the token anywhere

On success, the command prints **just the URL** on stdout. Print that URL to the user.

On failure (non-zero exit), the reason is on stderr. If it says to run `npx claudewall init`, tell the user to do that and stop. Otherwise show the error and continue with the next quote.
