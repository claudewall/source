# claudewall

A wall of memorable lines from Claude Code sessions.

## Stack

- Next.js 16 (App Router) on Vercel
- MongoDB Atlas (sessions, users, posts, follows, CLI device codes)
- Auth.js v5 with GitHub OAuth + MongoDB adapter
- Quote images rendered on the fly via `next/og` (Satori) — nothing stored as bytes
- Companion npm package `claudewall` (in `cli/`) registers a `/wall` slash command for Claude Code

## OAuth

There is **one** GitHub OAuth App, callback `https://claudewall.com/api/auth/callback/github`. GitHub OAuth apps allow only one callback URL, so local dev and Vercel preview deployments cannot complete a real GitHub sign-in against it — auth flows are tested on the production deploy.

## Local development

1. Copy env: `cp .env.local.example .env.local` (or use the pre-filled `.env.local` on this machine).
2. Install + run:
   ```sh
   npm install
   npm run dev
   ```
3. Iterate on UI, feed/profile rendering, image rendering, etc. To test sign-in, follow, and `/api/submit` end-to-end, deploy to Vercel and test on `claudewall.com`.

## Deploying to Vercel

Set these environment variables in the Vercel project:

- `MONGODB_URI`
- `MONGODB_DB` (optional, defaults to `claudewall`)
- `AUTH_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (the single OAuth app, callback `https://claudewall.com/api/auth/callback/github`)
- `AUTH_URL=https://claudewall.com`
- `NEXTAUTH_URL=https://claudewall.com`

`cli/` is excluded from the Vercel deploy via `.vercelignore`.

## CLI / `/wall` slash command

The `cli/` directory is a separate npm package, published as `claudewall`. End users run:

```sh
npx claudewall init
```

Which:

1. Hits `/api/cli/start` to get a device code, opens the browser to `/cli/approve?code=…`.
2. User signs in with GitHub and confirms — `/api/cli/poll` returns the minted bearer token.
3. Token is saved to `~/.claudewall/config.json` (mode `0600`).
4. `wall.md` is copied to `~/.claude/commands/wall.md`, registering the `/wall` slash command.

Then in any Claude Code session, `/wall` reads the active conversation, picks up to 10 standalone, context-free aphorisms from the assistant's recent turns, asks the user which to publish, and `POST`s each to `/api/submit` using the saved bearer token.

## Routes

| Path                       | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `/`                        | Masonry feed                                   |
| `/p/[postId]`              | Single quote                                   |
| `/u/[handle]`              | User profile + follow button                   |
| `/cli/approve`             | Browser approval page for the CLI device flow  |
| `/api/og/[postId]`         | Quote image (rendered on demand)               |
| `/api/submit`              | `POST` — bearer-token submit (used by `/wall`) |
| `/api/follow`              | `POST` — follow / unfollow                     |
| `/api/cli/start`           | `POST` — begin device flow                     |
| `/api/cli/poll`            | `POST` — poll for approval                     |
| `/api/auth/[...nextauth]`  | Auth.js routes                                 |

## Mongo collections

- `users`, `accounts`, `sessions`, `verification_tokens` — managed by Auth.js MongoDB adapter
- `posts` — `{ authorId, authorHandle, authorName, authorImage, quote, model?, rationale?, createdAt }`
- `follows` — `{ followerId, followeeId, createdAt }` (unique on `(followerId, followeeId)`)
- `cli_codes` — short-lived device-flow records
- `cli_tokens` — long-lived bearer tokens used by `/api/submit`
