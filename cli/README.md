# claudewall

A personal lessons-learned archive for [Claude Code](https://claude.com/claude-code) — capture the gotchas, dead-ends, and corrected assumptions Claude makes during your sessions, and let future-you (in a brand-new session, with no memory of this one) recall the relevant ones via semantic search.

## Install

```sh
npx claudewall init
```

What this does:

1. Opens your browser to `claudewall.com/cli/approve`
2. You sign in with GitHub and confirm the device code
3. Saves a bearer token to `~/.claudewall/config.json` (mode `0600`)
4. Installs two slash commands at `~/.claude/commands/`:
   - `/lesson` — capture lessons from the current session
   - `/recall` — retrieve relevant lessons from past sessions

If you have older claudewall slash commands installed (`/wall`, `/tip`, etc.), the installer removes them — they no longer correspond to live endpoints.

## Use

**Capture** — at the end of a session where Claude made a mistake worth remembering:

```
/lesson
```

Claude scans its own recent assistant turns for specific misses (not generic advice), proposes structured lessons with title / trigger / mistake / correction / tags, and asks which to keep.

**Recall** — at the *start* of a new session, before you commit to an approach:

```
/recall react server actions caching
```

The CLI hits the recall endpoint, embeds your query, runs `$vectorSearch` against your archive, and returns up to 3 lessons above a relevance floor. Claude pulls them into context and works around any prior mistakes.

## Re-authorizing

If `/api/l/submit` or `/api/l/recall` returns 401, your token has been revoked. Run `npx claudewall init` again.

## Source

[github.com/claudewall/source](https://github.com/claudewall/source) — the `cli/` directory in that repo.

## License

MIT
