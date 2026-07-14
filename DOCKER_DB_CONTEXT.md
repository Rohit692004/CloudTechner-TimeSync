# Docker / PostgreSQL Context — for handoff to a new session

Snapshot taken 2026-07-11. This documents **actual current state**, verified live
against the running container/DB — not just what was originally designed
(the app has evolved beyond my original build via edits outside this session).

## Important clarification up front

**Only PostgreSQL runs in Docker. The Next.js app itself is NOT containerized** —
there's no `Dockerfile`, and it runs directly on the host via `npm run dev` /
`npm run build` + `npm run start`. So "pushed the application in Docker" isn't
quite accurate yet — what exists is a **Dockerized database** that the
host-run app connects to. If full containerization of the app is wanted for
deployment, that's still to be built (see "Gaps" at the bottom).

A `docker-compose.prod.yml` (tuned Postgres config for production sizing) was
created earlier in this project's history but **has since been deleted** —
it no longer exists in the working directory. If production tuning is wanted
again, it needs to be recreated (it's documented in `PROJECT_PLAN.md` §7,
which still describes what it contained).

## 1. Docker setup

**`docker-compose.yml`** (only file that currently exists):
```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: timesheet
      POSTGRES_PASSWORD: timesheet
      POSTGRES_DB: timesheet
    ports:
      - "5434:5432"
    volumes:
      - timesheet_pg_data:/var/lib/postgresql/data

volumes:
  timesheet_pg_data:
```

Start/stop:
```bash
docker compose up -d       # start
docker compose ps          # check status
docker compose stop        # stop (keeps data)
docker compose down -v     # stop AND wipe the volume (destroys all data)
```

Currently running as container `timesheetapp-postgres-1`, up and healthy.

**Why port 5434, not the default 5432:** this dev machine already had a
native (non-Docker) Postgres instance bound to 5432, and another process
bound to 5433, so 5434 was the first free port. This is a local-machine
quirk — on a fresh deployment server, 5432 would likely be free and could be
used instead (just update both the compose file and `DATABASE_URL`).

## 2. Credentials (local/dev — NOT production-safe)

| Setting | Value |
|---|---|
| User | `timesheet` |
| Password | `timesheet` |
| Database name | `timesheet` |
| Host (from the app) | `127.0.0.1` — **use `127.0.0.1`, not `localhost`** (a Windows/WSL2/Docker Desktop quirk caused `localhost` to intermittently resolve to a stale IPv6 relay and fail to connect — see `.env.example` for the full note) |
| Port | `5434` (mapped from container's internal 5432) |

**Current `.env`:**
```
DATABASE_URL="postgresql://timesheet:timesheet@127.0.0.1:5434/timesheet?connection_limit=10&pool_timeout=20"
AUTH_SECRET="local-dev-secret-change-me"
AUTH_TRUST_HOST=true
```

These credentials are placeholder/dev-only — **must be rotated to real secrets
before any real deployment.** `AUTH_TRUST_HOST=true` is required for
self-hosted deployments behind a reverse proxy (Auth.js otherwise rejects
requests with "UntrustedHost" in production) — see the comment block in
`.env.example` for the safety caveat (only safe with a reverse proxy in front
controlling the Host header).

## 3. Database tables (14 total, live-verified)

Core app tables (present since early in the build):
- `Employee`, `Client`, `Project`, `Task`, `ProjectAllocation`
- `TimesheetHeader`, `TimesheetLine`, `ApprovalHistory`

Added later (beyond what I originally built — implemented via the reference
schema PDF you shared and/or other work outside this session):
- `Leave`, `LeaveBalance` — leave request/balance tracking
- `HolidayPlan`, `Holiday` — company/client holiday calendars
- `ImportRun` — tracks Keka timesheet import runs (fileName, row counts,
  new/skipped/mismatched stats, JSON report) — **this means the Keka import
  feature has real backend work now, beyond the "Coming Soon" placeholder
  page I built.** Worth checking what UI exists for it in a new session.

Plus Prisma's internal `_prisma_migrations` tracking table.

## 4. Current seed/example data (live-queried, not from memory)

**Employees (9):**

| ID | Name | Email | Role | Reports to |
|---|---|---|---|---|
| CT001 | Siba Prasad | siba@cloudtechner.com | TS_ADMIN | *(none)* |
| CT002 | Prabhakar | prabhakar@cloudtechner.com | TS_ADMIN | *(none)* |
| CT003 | Bhavya | bhavya@cloudtechner.com | HR_ADMIN | *(none)* |
| CT004 | Anil Kumar | anil@cloudtechner.com | PROJECT_MANAGER | *(none)* |
| CT005 | Rohit Gaur | rohit.gaur@cloudtechner.com | PROJECT_MANAGER | *(none)* |
| CT006 | Sachin | sachin@cloudtechner.com | EMPLOYEE | CT004 |
| CT007 | Rajat | rajat@cloudtechner.com | EMPLOYEE | CT004 |
| CT008 | Mehul | mehul@cloudtechner.com | EMPLOYEE | CT005 |
| CT009 | Rohit | rohit@cloudtechner.com | EMPLOYEE | CT005 |

Password for all: `password123`.

**Note — hierarchy has changed from what I originally built:** I had
designed Siba as a single org root with everyone else (including the other
TS_ADMIN/HR_ADMIN/PMs) reporting up to her. The live data now shows
**5 people with no reporting manager at all** (CT001–CT005), not just one
root. `title` is also empty for everyone (I had populated job titles like
"Director of Engineering," "Senior Software Engineer," etc. — that data
isn't present anymore). Someone rewrote `seed.ts` since I last touched it —
worth deciding in the new session whether the flatter hierarchy is
intentional or needs fixing back to a single-root model (this matters
because the approval-routing logic assumes everyone resolves to *some*
approver — multiple no-manager people is fine as long as each of those 5
has an `approverOverrideId` set for their own timesheet, which should be
double-checked).

**Clients (2):**
| Name | Code | Currency | Client Manager |
|---|---|---|---|
| Acme Corp | C001 | USD | CT001 (Siba) |
| Globex Inc | C002 | INR | CT003 (Bhavya) |

**Projects (3):**
| Name | Code | Status | Project Manager |
|---|---|---|---|
| Website Revamp | P0001 | IN_PROGRESS | CT004 (Anil) |
| Mobile App | P0002 | IN_PROGRESS | CT004 (Anil) |
| Data Platform | P0003 | IN_PROGRESS | CT005 (Rohit Gaur) |

**Holiday Plans (6):** Default (isDefault=true), Granicus, Bangalore - Klub,
Bangalore-Clover, Acme Corp, Globex Inc.

## 5. How to stand this up fresh (e.g. on a new machine/session)

```bash
docker compose up -d                    # start Postgres
npx prisma migrate deploy               # apply all migrations
npx prisma generate                     # generate the type-safe client
npm run db:seed                         # load seed data (wipes + reseeds)
npm run dev                             # run the app (localhost:3000)
```

Full walkthrough with troubleshooting is in `SETUP.md`.

## 6. Gaps for actual production deployment

- **The Next.js app is not containerized** — no `Dockerfile` exists. For a
  real deploy you'd either containerize it too, or run it via PM2/systemd
  directly on the server (both are valid; `PROJECT_PLAN.md` §7 describes the
  latter).
- **`docker-compose.prod.yml` was deleted** and needs recreating if you want
  the tuned production Postgres config (shared_buffers/work_mem sizing,
  `log_lock_waits=on`, etc.) — the values are documented in
  `PROJECT_PLAN.md` §7 even though the file itself is gone.
- **No backup automation currently wired up** — `scripts/backup-db.sh` was
  written earlier; confirm it still exists and is actually scheduled via cron
  wherever this deploys.
- **Credentials are dev-placeholder values** (`timesheet`/`timesheet`,
  `local-dev-secret-change-me`) — must be rotated before any real deploy.
- Concurrency was stress-tested and confirmed safe for 20–25 simultaneous
  writers (see `PROJECT_PLAN.md` §7) — that finding still holds regardless
  of the schema additions since then, but re-verify if the new
  Leave/Holiday/ImportRun write paths turn out to be heavy.
