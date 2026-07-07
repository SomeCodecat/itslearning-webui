# itslearning WebUI

A self-hosted student portal for [itslearning](https://itslearning.com): it syncs your courses, files, plans, tasks, grades and calendar into a local database and gives you a fast, searchable UI on top — including full-text file search, by-topic file browsing, bulk ZIP downloads and IHK exam tagging.

## Quick start (development)

Requirements: Node.js 20+ and [Yarn](https://yarnpkg.com/) (`yarn.lock` is the source of truth — don't use npm/pnpm lockfiles).

```bash
# 1. Install dependencies
yarn install

# 2. Configure the environment
cp example.env .env
#    Adjust DEFAULT_INSTANCE_URL to your school's itslearning instance
#    (custom instances can also be entered at login when ALLOW_CUSTOM_INSTANCE=true).

# 3. Create the SQLite database and generate the Prisma client
npx prisma migrate dev

# 4. Run the dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). On first run you'll be taken to `/setup` to create your local admin account; afterwards, log in and connect your itslearning credentials, then hit **Sync** in the top bar to pull in your data.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite connection string, e.g. `file:./app.db` |
| `EXTERNAL_URL` | URL the app is reachable at (used behind Docker/proxies) |
| `DEFAULT_INSTANCE_URL` | Default itslearning instance, e.g. `https://yourschool.itslearning.com` |
| `ALLOW_CUSTOM_INSTANCE` | `true`/`false` — let users enter a different instance URL at login |
| `ORGANIZATION_NAME` | Optional name shown on the login page |
| `SESSION_SECRET` / `ENCRYPTION_KEY` | Secret for signing session cookies and encrypting stored credentials. Optional in development (a dev-only fallback is used), **required in production** |
| `OIDC_*`, `NEXTAUTH_SECRET` | Optional OIDC single sign-on — see `example.env` |

### Useful commands

```bash
yarn dev          # dev server on :3000
yarn test         # vitest (watch mode); `yarn vitest run` for a single pass
yarn lint         # eslint
yarn build        # production build
yarn start        # serve the production build
npx prisma studio # inspect the local database
```

Runtime data lives in `prisma/app.db` (database) and `storage/blobs/` (downloaded file contents, deduplicated by hash) — treat both as local state and don't commit them.

## Running with Docker

```bash
cp example.env .env   # set your instance URL etc.
docker compose up -d
```

The compose file mounts `./storage` and `./prisma` as volumes so your database and downloaded files survive container rebuilds.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19, TypeScript
- [Prisma](https://prisma.io) + SQLite
- [next-intl](https://next-intl.dev) (English/German), Tailwind CSS
- [Vitest](https://vitest.dev) for tests
