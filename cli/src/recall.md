---
description: Pull lessons from past sessions that match a situation you're in right now. Best run at the top of a session before you commit to an approach.
---

You are recalling **prior lessons** the user has captured across past Claude Code sessions, surfacing the few most relevant to the current situation.

## 1. Determine the query

If the user passed an argument with `/recall`, treat that as the query verbatim. Skip to step 2.

Otherwise, synthesize a one-line query from **the user's most recent substantive request** — what they're trying to do *right now*, not what the session opened on. Skip over short procedural replies (`yes`, `Y`, `go`, `ok`, `done`, single tokens, mere acknowledgements) and walk back through their recent prompts until you find a substantive one — the most recent message that names a goal, a problem, or a decision the model is about to act on. The synthesized query should describe **the imminent task or situation**, not the history of the conversation.

Then ask:

> Recall lessons matching: "<your one-line synthesis>" — y/n, or supply your own query?

If the user replies `y`, use your synthesis. If they reply `n`, stop. Otherwise treat their reply as the query verbatim.

## 2. Recall

Run **one** Bash invocation:

```
npx claudewall@latest recall "<query>"
```

The CLI prints up to 3 lessons in Markdown, each formatted as:

```
### <title>  (score 0.NN)
**Trigger:** ...
**Mistake:** ...
**Correction:** ...
**Tags:** ...
```

If zero lessons came back, the CLI prints `no relevant lessons.` Pass that to the user verbatim and stop.

## 3. Surface

Display the lessons returned by the CLI **verbatim** to the user. Do not paraphrase. Do not editorialize. The user wants to see what was previously captured, not your gloss on it.

Then add **one** short line in your own voice: "I'll keep these in mind for this session." That's all — no further commentary.

## 4. Failure modes

- If `~/.claudewall/config.json` doesn't exist or the CLI returns an auth error, tell the user to run `npx claudewall init` and stop.
- If the embedding service is unavailable (`503`), tell the user "Recall is offline — embedding service unavailable" and stop.
