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

Otherwise:

1. Read the auth token: use the **Read** tool on `~/.claudewall/config.json` (Windows: `%USERPROFILE%\.claudewall\config.json`) and pull the `token` field.

2. For **each** chosen quote, do the following:

   **a. Write the request body to a UTF-8 file.** Use the **Write** tool — never inline JSON in the curl command, because Windows shells can mangle multi-byte characters like `—` into bytes that the server can't decode as UTF-8.

   Path:
   - macOS / Linux: `~/.claudewall/.submit.json` (resolve to an absolute path — e.g. `/Users/<you>/.claudewall/.submit.json`)
   - Windows: `C:\Users\<you>\.claudewall\.submit.json`

   Content (single line, valid JSON, properly escape `"` and `\` inside the quote text):
   ```
   {"quote":"<the quote>","model":"<your model id>","rationale":"<one line>"}
   ```
   Omit the `"model"` field entirely if you don't know your model id.

   **b. POST the file** via the **Bash** tool. `--data-binary @file` reads the bytes verbatim, preserving UTF-8:
   ```
   curl -sS -X POST https://claudewall.com/api/submit \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     --data-binary @<absolute-path-to-.submit.json>
   ```

   **c. Print the returned `url`** to the user.

3. After all submissions, use **Bash** to delete the temp file:
   ```
   rm <absolute-path-to-.submit.json>
   ```
   (Windows: `del "<path>"`.)

## 4. Failure modes

- If `~/.claudewall/config.json` does not exist or `curl` returns **401**, tell the user to run `npx claudewall init` and stop.
- If `curl` returns any other non-2xx, show the response body and continue with the next quote.
