# CloudTechner TimeSync — Local Setup Guide

A step-by-step guide to run this timesheet app on a fresh machine. No prior
knowledge of the project is assumed. Distributed as a **zip** (not GitHub).

---

## 1. Prerequisites

Install these first:

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 20 LTS or newer (tested on v24) | https://nodejs.org — includes `npm` |
| **Docker Desktop** | any recent version | https://www.docker.com/products/docker-desktop — used to run PostgreSQL. Make sure it is **running** before you start. |

Check they're installed (open a terminal):

```bash
node --version      # should print v20.x or higher
npm --version
docker --version
docker ps           # should NOT error — confirms Docker Desktop is running
```

> No database install needed — PostgreSQL runs inside Docker.
> No Git needed — you have the code as a zip.

---

## 2. Unzip & open a terminal in the project folder

1. Extract the zip somewhere without special characters if possible (a path
   with spaces like `Timesheet app` works, but avoid anything exotic).
2. Open a terminal **inside** the extracted folder (the one containing
   `package.json`). On Windows you can use PowerShell, Command Prompt, or Git Bash.

> **If the zip came with `node_modules/` or `.next/` folders, delete them first.**
> They contain machine-specific binaries from another computer and will cause
> errors. A clean `npm install` (next step) rebuilds them correctly.
> ```bash
> # optional cleanup if these exist:
> rm -rf node_modules .next        # macOS/Linux/Git Bash
> # PowerShell: Remove-Item -Recurse -Force node_modules, .next
> ```

---

## 3. Install dependencies

```bash
npm install
```

This installs Next.js, Prisma, NextAuth, Tailwind, etc. Takes a couple of minutes.

---

## 4. Create your environment file

The app reads settings from a `.env` file, which is **not** included in the zip
(it holds secrets). Create it from the template:

```bash
# macOS/Linux/Git Bash:
cp .env.example .env

# PowerShell:
Copy-Item .env.example .env
```

Then open `.env` and set a real `AUTH_SECRET` (any long random string). Quick way:

```bash
npx auth secret          # generates one and writes it into .env for you
```

The default `DATABASE_URL` in the template already matches the Docker setup below
— you usually don't need to change it.

---

## 5. Start the database (Docker)

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container. It publishes the database on **host port
5434** (not the default 5432, to avoid clashing with any Postgres already on your
machine). The connection string in `.env` already points at 5434.

Verify it's up:

```bash
docker compose ps        # STATUS should say "Up"
```

> **Port already in use?** If `docker compose up` complains that port 5434 is
> taken, pick a free port (e.g. 5435): change `"5434:5432"` in
> `docker-compose.yml` **and** the `5434` in your `.env` `DATABASE_URL` to match,
> then run `docker compose up -d` again.

---

## 6. Set up the database schema & sample data

```bash
npx prisma migrate deploy    # creates all tables from the migration files
npx prisma generate          # generates the type-safe DB client
npm run db:seed              # loads sample clients, projects, employees, allocations
```

You should see the seed print a list of login accounts at the end.

---

## 7. Run the app

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. You'll be redirected to the login
page.

> If port 3000 is busy, Next.js will pick another port and print it in the
> terminal (e.g. http://localhost:3001).

---

## 8. Log in — test accounts

Every seeded account uses the password **`password123`**.

| Role | Name | Email |
|---|---|---|
| Timesheet Admin | Siba Prasad | `siba@cloudtechner.com` |
| Timesheet Admin | Prabhakar | `prabhakar@cloudtechner.com` |
| HR Admin | Bhavya | `bhavya@cloudtechner.com` |
| Project Manager | Anil Kumar | `anil@cloudtechner.com` |
| Project Manager | Rohit Gaur | `rohit.gaur@cloudtechner.com` |
| Employee | Sachin | `sachin@cloudtechner.com` |
| Employee | Rajat | `rajat@cloudtechner.com` |
| Employee | Mehul | `mehul@cloudtechner.com` |
| Employee | Rohit | `rohit@cloudtechner.com` |

**Reporting / approval structure** (for testing the approval flow):
- Sachin & Rajat report to **Anil**
- Mehul & Rohit report to **Rohit Gaur**
- Anil and Rohit Gaur approve each other (nobody approves their own timesheet)

**Suggested end-to-end test:** log a week as **Sachin** → Save Draft → Submit;
then log in as **Anil** to approve or reject it; check org-wide status as
**Bhavya** (HR); manage clients/projects/allocations as **Siba** (Admin).

---

## Everyday commands (after first setup)

```bash
npm run dev                 # start the app
docker compose up -d        # start the database (if stopped)
docker compose stop         # stop the database (keeps data)
npm run db:seed             # re-load sample data (safe to re-run; idempotent)
```

Your data persists in a Docker volume between restarts. To wipe it and start
fresh: `docker compose down -v` then repeat step 6.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker ps` errors / "cannot connect to Docker daemon" | Docker Desktop isn't running — start it and wait until it's ready. |
| `Environment variable not found: DATABASE_URL` | You skipped step 4 — create `.env` from `.env.example`. |
| Port 5434 already allocated | Change the port in `docker-compose.yml` and `.env` (see step 5 note). |
| App shows a 500 / Turbopack error after moving folders | Stop the dev server, delete the `.next` folder, run `npm run dev` again. |
| Prisma "engine" / client errors after install | Run `npx prisma generate` again. |
| Login always fails | Make sure you ran `npm run db:seed`, and use password `password123`. |

---

## What's in the box (project layout)

```
prisma/
  schema.prisma        # database models
  migrations/          # database schema history
  seed.ts              # sample data
src/
  app/                 # pages & API routes (Next.js App Router)
    login/             # login page
    (dashboard)/       # role dashboards: admin, hr, manager, employee
  lib/                 # auth, prisma client, helpers
  components/          # shared UI components
docker-compose.yml     # local PostgreSQL
.env.example           # environment template (copy to .env)
PROJECT_PLAN.md        # full architecture & roadmap
```

---

## Packaging the project (for whoever creates the zip)

> This section is for the **sender** — the person zipping the project to share it.
> If you're setting up a received zip, you can ignore this.

Before zipping, exclude these — they're large and/or machine-specific, and the
recipient rebuilds them during setup:

- `node_modules/` — huge; contains OS-specific Prisma/tsx binaries that won't run on another machine
- `.next/` — build cache; a stale copy causes startup errors on the new machine
- `.env` — your local secrets; the recipient makes their own from `.env.example`
- `.git/` — version history, not needed for a zip share

**Windows (PowerShell)** — run from the project's *parent* folder (adjust the
source name if your folder differs):

```powershell
$src = "Timesheet app"
$dst = "TimeSync-clean"
robocopy $src $dst /E /XD node_modules .next .git /XF .env | Out-Null
Compress-Archive -Path "$dst\*" -DestinationPath "TimeSync.zip" -Force
Remove-Item -Recurse -Force $dst
```

**macOS/Linux** — run from *inside* the project folder:

```bash
zip -r ../TimeSync.zip . -x 'node_modules/*' '.next/*' '.git/*' '.env'
```

The resulting `TimeSync.zip` is what you share. The recipient follows this guide
from step 2. Keep `.env.example`, `prisma/`, and `PROJECT_PLAN.md` in the zip —
they're needed.

---

## Notes

- This is a **local development build**. It is not hardened for production
  (see `PROJECT_PLAN.md` §7 for the deployment plan).
- The `AUTH_SECRET` and seeded passwords are for local testing only — never use
  them in a real deployment.
