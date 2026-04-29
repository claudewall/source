# claudewall

A personal lessons-learned archive for Claude Code. Capture the gotchas, dead-ends, and corrected assumptions Claude makes during a session, then recall the relevant ones via semantic search at the start of a future session — so the same mistake isn't repeated by a stateless model with no memory of the prior conversation.

## Stack

- Next.js 16 (App Router) on Vercel
- MongoDB Atlas — `lessons` collection with a vector search index over a 512-dim Voyage embedding
- Auth.js v5 with GitHub OAuth + MongoDB adapter
- Companion npm package `claudewall` (in `cli/`) registers `/lesson` and `/recall` slash commands for Claude Code

## OAuth

There is **one** GitHub OAuth App, callback `https://claudewall.com/api/auth/callback/github`. GitHub OAuth apps allow only one callback URL, so local dev and Vercel preview deployments can't complete a real GitHub sign-in against it — auth flows are tested on the production deploy.

## Local development

1. `cp .env.local.example .env.local` (or use the pre-filled `.env.local` on this machine)
2. Install + run:
   ```sh
   npm install
   npm run dev
   ```
3. Iterate on UI, lesson rendering, recall page, etc. Sign-in and full `/api/l/*` flows are easiest to test on the deployed site.

## Deploying to Vercel

Required env vars:

- `MONGODB_URI`
- `MONGODB_DB` (defaults to `claudewall`)
- `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (callback `https://claudewall.com/api/auth/callback/github`)
- `AUTH_URL=https://claudewall.com`
- `NEXTAUTH_URL=https://claudewall.com`
- `VOYAGE_API_KEY` (Voyage AI — embeddings for `/recall`)

`cli/` is excluded from the Vercel deploy via `.vercelignore`.

## Atlas vector search index

In Atlas → Search → Vector Search Indexes, create `lessons_vector_index` on the `lessons` collection of the `claudewall` database with:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 512,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "authorId"
    }
  ]
}
```

The `authorId` filter scopes recall queries to the requesting user's own lessons.

## CLI / slash commands

Users authorize once with:

```sh
npx claudewall init
```

That writes a bearer token to `~/.claudewall/config.json` and installs:

- `~/.claude/commands/lesson.md` — `/lesson` slash command (capture)
- `~/.claude/commands/recall.md` — `/recall` slash command (retrieve)

In any Claude Code session:

- `/lesson` — Claude proposes structured lessons from the recent transcript, you pick which to keep
- `/recall <free text>` — pulls up to 3 of your prior lessons most relevant to a situation you're in now

## Routes

| Path                       | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `/`                        | Redirect to `/l`                                   |
| `/l`                       | Your lessons (signed-in only)                      |
| `/l/[id]`                  | Single lesson detail                               |
| `/l/recall`                | Browser recall UI (semantic search over your archive) |
| `/u/[handle]`              | Profile (lesson count; full list only when viewing your own) |
| `/cli/approve`             | Browser approval page for the CLI device flow      |
| `/api/l/submit`            | `POST` — bearer-auth submit (used by `/lesson`)    |
| `/api/l/recall`            | `GET` — bearer or session auth, returns up to 3 lessons |
| `/api/cli/{start,poll}`    | CLI device-flow auth                               |
| `/api/auth/[...nextauth]`  | Auth.js                                            |

## Mongo collections

- `users`, `accounts`, `sessions`, `verification_tokens` — managed by Auth.js MongoDB adapter
- `lessons` — `{ authorId, title, trigger, mistake, correction, tags[], weight, embedding[], createdAt, ... }`
- `cli_codes`, `cli_tokens` — CLI device-flow auth state
