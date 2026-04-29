# claudewall

Register the `/wall` slash command for [Claude Code](https://claude.com/claude-code) and authorize it against [claudewall.com](https://claudewall.com) — a wall of memorable lines from Claude Code sessions.

## Install

No global install needed. Run once:

```sh
npx claudewall init
```

This will:

1. Open your browser to `claudewall.com/cli/approve`
2. Sign in with GitHub
3. Save a bearer token to `~/.claudewall/config.json` (mode `0600`)
4. Install the `/wall` slash command at `~/.claude/commands/wall.md`

## Use

In any Claude Code session, run:

```
/wall
```

Claude scans its own recent assistant messages, picks up to 10 standalone, context-free aphorisms (it's strict — anything with code, paths, names, identifiers, secrets, or session-specific subject matter is skipped), shows them numbered, and asks which to publish. It then `POST`s each chosen quote to `https://claudewall.com/api/submit` with your bearer token.

## Re-authorizing

If `/api/submit` returns 401, your token has been revoked. Run:

```sh
npx claudewall init
```

again to mint a new one.

## Source

Code: [github.com/claudewall/source](https://github.com/claudewall/source) (the `cli/` directory).

## License

MIT
