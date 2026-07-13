# CloudTechner TimeSync — Infrastructure, Architecture & Operations Guide

A single reference for standing up, understanding, and operating the TimeSync
timesheet application. Covers the tech stack, a full architecture diagram, the
complete database schema and relationships, local + production installation, the
deploy/push flow, and the exact nginx and PostgreSQL setup used on the VM.

---

## 1. Overview

TimeSync is an in-house weekly timesheet portal: employees log hours against
project tasks, managers approve, and HR/Timesheet admins manage clients,
projects, allocations, holidays, and bulk data import/export. It is a single
Next.js application (frontend + server logic + API in one codebase) backed by a
PostgreSQL database via Prisma.

| Layer | Technology |
|-------|-----------|
| Framework | Next.js **16.2.10** (App Router, Turbopack, React **19.2**) |
| Language | TypeScript 5 |
| Auth | NextAuth (Auth.js) v5 beta — credentials (email + bcrypt password) |
| ORM | Prisma **6.19.3** |
| Database | PostgreSQL |
| UI | Tailwind CSS v4, Base UI (`@base-ui/react`), shadcn-style components, lucide icons |
| Excel import/export | `xlsx` (SheetJS) |
| Process manager (prod) | pm2 |
| Reverse proxy (prod) | nginx |
| Runtime | Node.js 20+ (VM), 24 (local dev) |

---

## 2. Architecture Diagram

```
                              ┌─────────────────────────┐
                              │        Browser          │
                              │  (TS_ADMIN / HR_ADMIN /  │
                              │   PROJECT_MANAGER /      │
                              │      EMPLOYEE)           │
                              └────────────┬────────────┘
                                    HTTP :80 (plain, "Not secure")
                                           │
                              ┌────────────▼────────────┐
                              │          nginx          │
                              │  server_name            │
                              │   163.192.98.32         │
                              │  proxy_pass →           │
                              │   127.0.0.1:3001        │
                              │  client_max_body_size   │
                              │   20M                   │
                              │  proxy_read/send_timeout│
                              │   180s                  │
                              └────────────┬────────────┘
                                           │
                              ┌────────────▼────────────────────────────┐
                              │   Next.js app (pm2: "timesheet-app")     │
                              │   `next start` on :3001                  │
                              │   user: timesheet                        │
                              │   cwd: /home/timesheet/timesheet-app     │
                              │                                          │
                              │  ┌────────────────────────────────────┐  │
                              │  │  App Router (src/app/(dashboard))  │  │
                              │  │  • /employee   My Timesheet        │  │
                              │  │  • /manager    Approvals           │  │
                              │  │  • /admin/*    TS_ADMIN area       │  │
                              │  │  • /hr/*       HR_ADMIN area       │  │
                              │  │  • /login, /api/auth/[...nextauth] │  │
                              │  └───────────────┬────────────────────┘  │
                              │                  │                        │
                              │  ┌───────────────▼────────────────────┐  │
                              │  │  Server Actions ("use server")     │  │
                              │  │  + plain lib logic (src/lib/*)     │  │
                              │  │  auth-guards → requireRole(...)    │  │
                              │  └───────────────┬────────────────────┘  │
                              │                  │ Prisma Client          │
                              └──────────────────┼────────────────────────┘
                                                 │
                              ┌──────────────────▼───────────────────────┐
                              │        PostgreSQL (localhost:5432)        │
                              │        database: timesheet_prod           │
                              │        role: timesheet_app                │
                              │        (13 tables, see §4)                │
                              └───────────────────────────────────────────┘

  Same VM, fully isolated (do NOT touch when deploying TimeSync):
  ┌───────────────────────────────────────────────────────────────────────┐
  │  Scout app — pm2 procs scout-web/scout-ai/scout-scheduler/scout-watcher│
  │  (user: ubuntu), nginx server_name scout.cloudtechner.com → :3000      │
  └───────────────────────────────────────────────────────────────────────┘
```

### Request lifecycle
1. Browser hits `http://163.192.98.32` → nginx.
2. nginx proxies to the Next.js server on `127.0.0.1:3001`.
3. Middleware (`src/proxy.ts`) + NextAuth session guard the routes; unauthenticated requests `307 → /login`.
4. Server Components render pages; mutations go through Server Actions, which call `requireRole(...)` then Prisma.
5. Prisma talks to PostgreSQL on the same VM.

### Role → landing page
| Role | Landing route | Can access |
|------|--------------|-----------|
| `EMPLOYEE` | `/employee` | own timesheet |
| `PROJECT_MANAGER` | `/manager` | approvals (+ own timesheet) |
| `HR_ADMIN` | `/hr` | employees, holidays, import/export |
| `TS_ADMIN` | `/admin` | clients, projects, allocations, history, import/export |

Layout guards: `admin/layout.tsx` allows **TS_ADMIN only**; `hr/layout.tsx` allows **HR_ADMIN + TS_ADMIN**. This is why the bulk import lives under `/hr/import-timesheets` (reachable by both) rather than `/admin`.

---

## 3. Repository layout

```
src/
  app/
    (dashboard)/
      layout.tsx            # sidebar nav, role-based menu
      employee/             # My Timesheet (grid, actions)
      manager/              # Approvals (review dialog)
      admin/                # TS_ADMIN: dashboard, clients, projects, allocations, history
      hr/                   # HR_ADMIN: dashboard, employees, holidays, import-timesheets
    login/                  # credentials login
    api/auth/[...nextauth]/ # NextAuth handler
  lib/
    prisma.ts               # Prisma client singleton
    auth.ts, auth-guards.ts # NextAuth config + requireRole()
    roles.ts, dates.ts, allocation.ts, codes.ts, constants.ts
    stale-allocations.ts    # allocation-lifecycle cleanup logic
  components/ui/            # shadcn-style Base UI components
prisma/
  schema.prisma            # data model (source of truth)
  migrations/              # 5 migrations (see §4.3)
  seed.ts, bootstrap-admin.ts
scripts/
  import-roster.ts                 # generate SQL from Keka exports
  cleanup-stale-allocations.ts     # one-time allocation cleanup (preview/--apply)
next.config.ts             # serverActions.bodySizeLimit 20mb, devIndicators off
```

---

## 4. Database Schema

PostgreSQL, 13 tables. `Employee` is the hub — nearly everything references it.
Full definitions live in `prisma/schema.prisma`.

### 4.1 Enums
| Enum | Values |
|------|--------|
| `EmployeeRole` | EMPLOYEE, PROJECT_MANAGER, HR_ADMIN, TS_ADMIN |
| `TimesheetStatus` | DRAFT, SUBMITTED, APPROVED, REJECTED |
| `ProjectStatus` | NOT_STARTED, IN_PROGRESS, ON_HOLD, COMPLETED |
| `BillingModel` | TIME_AND_MATERIAL, FIXED_FEE, RETAINER, NON_BILLABLE |
| `LeaveType` | CASUAL, SICK, EARNED |
| `LeaveStatus` | PENDING, APPROVED, REJECTED |

### 4.2 Tables & key columns

**Employee** — the hub. `id` is the Keka Employee ID (text, no regeneration).
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | = Keka Employee ID |
| name, email | text | email **unique** |
| passwordHash | text | bcrypt |
| role | EmployeeRole | default EMPLOYEE |
| title, phone | text? | |
| reportingManagerId | text? → Employee | self-relation "ReportingManager" |
| approverOverrideId | text? → Employee | self-relation "ApproverOverride" |
| holidayPlanId | text? → HolidayPlan | |
| isActive | bool | default true |

**Client**
| id (uuid PK), name, code (unique, e.g. C011), country, billingCurrency, clientManagerId (→ Employee), billing/address fields, isActive |

**Project**
| id (uuid PK), clientId (→ Client), name, code (unique, e.g. P0022), status (ProjectStatus), projectManagerId (→ Employee), startDate, endDate, costBudget, hoursBudget, billingModel, linkExpenses, isActive |

**Task**
| id (uuid PK), projectId (→ Project), name, isDefaultTemplate, isActive, startDate?, endDate? | Default tasks auto-created per project: "Project work", "Project work - WFH", "Project work - Client", "Training". **No unique constraint** on (projectId, name). |

**ProjectAllocation** — who is on what project, for what % and date range.
| id (uuid PK), projectId (→ Project), employeeId (→ Employee), allocationPercentage (int 5–100), startDate (date), endDate (date?, null = open-ended), createdById (→ Employee) |
| **@@unique([employeeId, projectId, startDate])** — allows staggered re-allocation with a different start. `@@index([employeeId, startDate, endDate])` |

**TimesheetHeader** — one row per (employee, week).
| id (uuid PK), employeeId (→ Employee), weekStartDate (date, always Monday), status (TimesheetStatus), approvedById (→ Employee), submittedAt, approvedAt, rejectionComments, totalHours, isLate, lateApproved |
| **@@unique([employeeId, weekStartDate])** |

**TimesheetLine** — hours per task per day.
| id (uuid PK), timesheetHeaderId (→ TimesheetHeader, **onDelete Cascade**), taskId (→ Task), workDate (date), hours (decimal), notes? |
| **@@unique([timesheetHeaderId, taskId, workDate])**, `@@index([timesheetHeaderId])` |

**ApprovalHistory**
| id (uuid PK), timesheetHeaderId (→ TimesheetHeader), actorId (→ Employee), action (SUBMITTED/APPROVED/REJECTED/RESUBMITTED/…), comments?, createdAt |

**Leave**
| id (uuid PK), employeeId (→ Employee, Cascade), leaveType (LeaveType), startDate, endDate, status (LeaveStatus), reason? |

**LeaveBalance** (1:1 with Employee)
| id (uuid PK), employeeId (unique → Employee, Cascade), casual (def 12), sick (def 12), earned (def 15) |

**HolidayPlan**
| id (uuid PK), name (unique), isDefault | employees follow a plan via `Employee.holidayPlanId` |

**Holiday**
| id (uuid PK), holidayPlanId (→ HolidayPlan, Cascade), name, date, isFloaterLeave, specialHoliday |

**ImportRun** — audit row per bulk import (see /hr/import-timesheets).
| id (uuid PK), fileName, importedById (→ Employee), importedAt, plus count columns (totalDataRows, usableRows, weeksNew, headersCreated, linesCreated, unknown/mismatch counts, …), reportDetailsJson (full JSON report for re-download) |

### 4.3 Relationships (foreign keys)

```
Employee ──self──▶ Employee            (reportingManagerId, approverOverrideId)
Employee ──▶ HolidayPlan               (holidayPlanId)
Client   ──▶ Employee                  (clientManagerId)
Project  ──▶ Client                    (clientId)
Project  ──▶ Employee                  (projectManagerId)
Task     ──▶ Project                   (projectId)
ProjectAllocation ──▶ Project, Employee(x2: employeeId, createdById)
TimesheetHeader   ──▶ Employee(x2: employeeId, approvedById)
TimesheetLine     ──▶ TimesheetHeader (Cascade), Task
ApprovalHistory   ──▶ TimesheetHeader, Employee(actorId)
Leave, LeaveBalance ──▶ Employee (Cascade)
Holiday  ──▶ HolidayPlan (Cascade)
ImportRun ──▶ Employee (importedById)
```

**How the core flow connects:** an `Employee` gets a `ProjectAllocation` to a
`Project` (which belongs to a `Client` and has `Task`s). Each week they create a
`TimesheetHeader`, with `TimesheetLine`s logging `hours` against a `Task` on a
`workDate`. Submission/approval events are recorded in `ApprovalHistory`. The
resolved approver is stored on `TimesheetHeader.approvedById`.

### 4.4 Migrations (applied in order)
1. `20260706153153_init`
2. `20260706170000_allocation_unique_constraint`
3. `20260706173000_keka_client_project_fields`
4. `20260709180000_add_leave_and_holiday_models`
5. `20260710220000_add_import_run`

Apply with `npx prisma migrate deploy` (production) — additive; safe/idempotent.

---

## 5. Local Installation (development)

**Prerequisites:** Node.js 20+, Docker (for local Postgres) or a local Postgres, npm.

```bash
# 1. Clone
git clone https://github.com/SachinR007/CloudTechner-TimeSync.git
cd CloudTechner-TimeSync

# 2. Install deps
npm install

# 3. Environment — create .env
#    DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/timesheet_dev"
#    AUTH_SECRET="<random string: openssl rand -base64 32>"
#    (see .env.example)

# 4. Start local Postgres (Docker Compose provided)
docker compose up -d           # brings up the timesheetapp-postgres container

# 5. Apply migrations + generate client
npx prisma migrate deploy
npx prisma generate

# 6. Seed sample data (optional, dev only)
npm run db:seed

# 7. Run the dev server
npm run dev                    # http://localhost:3000
```

**First admin (fresh DB, no seed):**
```bash
ADMIN_ID=CT001 ADMIN_NAME="Jane Doe" ADMIN_EMAIL=jane@company.com \
ADMIN_PASSWORD='Str0ngPass' ADMIN_ROLE=TS_ADMIN \
npx tsx prisma/bootstrap-admin.ts
```
`ADMIN_ROLE` defaults to HR_ADMIN; it never overwrites an existing id/email.

---

## 6. Production Deploy / Push Flow

> Full VM specifics (host, users, isolation from the Scout app) are in §7.

### 6.1 Push new code from your machine
```bash
# on your dev machine, on the feature branch
git add -A
git commit -m "…"
git push origin feature/bulk-import-export-and-fixes
```

### 6.2 Deploy on the VM
Run **as the `timesheet` user, from the repo directory** (see §7 — this matters):
```bash
sudo su - timesheet
cd /home/timesheet/timesheet-app        # REQUIRED — su drops you in /home/timesheet

git pull origin feature/bulk-import-export-and-fixes

# only when dependencies changed:
npm ci

# only when the Prisma schema/migrations changed:
npx prisma generate
npx prisma migrate deploy               # additive; safe to re-run

npm run build
pm2 restart timesheet-app
pm2 logs timesheet-app --lines 20 --nostream   # confirm "✓ Ready"
```

### 6.3 Smoke test
```bash
curl -I http://127.0.0.1:3001           # expect 307 → /login
```
Then in a browser hard-refresh `http://163.192.98.32`, log in, and check
`/hr/import-timesheets`, `/employee`, `/manager`.

### 6.4 Rollback
```bash
pm2 stop timesheet-app
git checkout <previous-branch-or-commit>
npm ci && npx prisma generate && npm run build
pm2 restart timesheet-app
```
Additive migrations don't need reversing; restore from a `pg_dump` only if data
was affected (see §8.4).

### 6.5 Opening a PR
`gh` CLI is not installed locally — open PRs in the browser:
`https://github.com/Rohit692004/CloudTechner-TimeSync/compare/main...SachinR007:CloudTechner-TimeSync:<branch>?expand=1`
(`origin` = fork `SachinR007/…`; `upstream`/PR target = `Rohit692004/…`.)

---

## 7. VM Setup Details

| Item | Value |
|------|-------|
| Host | `163.192.98.32` (instance `instance-20260608-0558`) |
| Login | `ubuntu` → then `sudo su - timesheet` |
| App owner (OS user) | `timesheet` |
| Repo path | `/home/timesheet/timesheet-app` |
| App port | `3001` (`next start`) |
| Process manager | pm2 process **`timesheet-app`** (id 0), under the `timesheet` user |
| Git `origin` | `https://github.com/SachinR007/CloudTechner-TimeSync.git` |

**Gotchas (learned the hard way):**
- `sudo su - timesheet` lands in `/home/timesheet`, **not** the repo — always
  `cd /home/timesheet/timesheet-app` first, or `git`/`npm` fail.
- Run all git/npm/pm2 commands **as `timesheet`**. As `ubuntu` you get
  dubious-ownership / permission-denied errors (`sudo -u timesheet pm2 list` to
  peek at the process from the ubuntu shell).
- Served over **plain HTTP** (no TLS) — browser secure-context APIs like
  `crypto.randomUUID()` are unavailable; don't rely on them client-side.

**Coexisting Scout app — do not touch when deploying TimeSync:**
- pm2 procs `scout-web`, `scout-ai`, `scout-scheduler`, `scout-watcher` (user `ubuntu`).
- nginx server block `scout.cloudtechner.com` → `127.0.0.1:3000`.
- Separate app, separate port, its own DB — fully isolated from TimeSync.

---

## 8. nginx Configuration

File: `/etc/nginx/sites-available/timesheet-app` (symlinked into
`/etc/nginx/sites-enabled/`). TimeSync's block only — Scout has its own file.

```nginx
server {
    listen 80;
    server_name 163.192.98.32;

    location / {
        proxy_pass http://127.0.0.1:3001;

        # Raised for the bulk timesheet import (large multi-year Excel + slow
        # DB writes). Defaults (60s / 1M) were too small.
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Also raised globally for large uploads (http/server block):
```nginx
client_max_body_size 20M;
```

Apply changes safely:
```bash
sudo cp /etc/nginx/sites-available/timesheet-app /etc/nginx/sites-available/timesheet-app.bak
# edit…
sudo nginx -t                    # must say "syntax is ok" / "test is successful"
sudo systemctl reload nginx      # graceful — no dropped connections, Scout untouched
```

> Note: the app also caps Server Action bodies at 20MB in `next.config.ts`
> (`experimental.serverActions.bodySizeLimit: "20mb"`) and the import DB
> transaction at 60s — both must stay ≥ what nginx allows for large imports to work.

---

## 9. PostgreSQL Setup

| Item | Value |
|------|-------|
| Location | local on the VM, `127.0.0.1:5432` |
| Database | `timesheet_prod` |
| App role | `timesheet_app` |
| Connection | via `DATABASE_URL` in the repo's `.env` (never hardcode the password) |

Connect for manual queries (needs the URL — a bare `psql` as `ubuntu`/`timesheet`
has no matching role):
```bash
psql "postgresql://timesheet_app:<password>@127.0.0.1:5432/timesheet_prod"
```
The password contains URL-special characters, so it is percent-encoded in the
connection string (e.g. `!`→`%21`, `$`→`%24`, `#`→`%23`, `@`→`%40`). The real
value lives in the VM `.env`.

**Create the role/db on a fresh server:**
```sql
CREATE ROLE timesheet_app WITH LOGIN PASSWORD '<strong-password>';
CREATE DATABASE timesheet_prod OWNER timesheet_app;
```
Then set `DATABASE_URL` in `.env` and run `npx prisma migrate deploy`.

### Current scale (reference)
~63 employees, 20 clients, 41 projects; 13 tables. Timesheet volume grows with
imports (thousands of `TimesheetLine` rows across the imported months).

---

## 10. Operational Runbooks

### 10.1 Bulk timesheet import
UI: `/hr/import-timesheets` (TS_ADMIN or HR_ADMIN). Upload a Keka "Employees
Timesheet Entries" export → **preview** (validates, flags unknown employees/
projects, duplicates) → **Confirm Import** (writes inside a transaction with
`skipDuplicates`; re-running the same file adds nothing). History tab re-downloads
any past run's report. Export tab: filter by employee(s) + year/month → Excel.

### 10.2 Moving someone between projects (ongoing, manual)
On `/admin/allocations`:
- **End** — closes an allocation as of today.
- **Edit** (pencil) — set a specific start/end date (backdated corrections).
- **Create Allocation** — add them to the new project.
Each allocation row is per-person; ending one never affects others on the project.

### 10.3 One-time stale-allocation cleanup
Artifact of the bulk import (open-ended allocations to projects people left).
```bash
cd /home/timesheet/timesheet-app
npx tsx scripts/cleanup-stale-allocations.ts            # PREVIEW — writes nothing
npx tsx scripts/cleanup-stale-allocations.ts --apply    # apply
```
- **Part 1** closes open allocations with no entries in the last 30 days (new
  joiners guarded out) at their last-logged date.
- **Part 2** corrects allocations ended >30 days after the last actual entry
  (e.g. a manual "End today" on something last logged long ago) back to the
  real last-logged date. Idempotent.

### 10.4 Backup before risky changes
```bash
pg_dump "postgresql://timesheet_app:<password>@127.0.0.1:5432/timesheet_prod" \
  -F c -f ~/backups/timesync_$(date +%Y%m%d_%H%M%S).dump
```

---

## 11. Security & Access Notes
- Passwords stored as bcrypt hashes; login is email + password (NextAuth credentials).
- Every mutating Server Action calls `requireRole(...)`; layout guards enforce the
  admin/HR boundary.
- Self-approval is blocked (an approver can't be the submitting employee).
- Served over plain HTTP today — putting TLS in front (Let's Encrypt on nginx) is
  the recommended next hardening step; also rotate the DB password if it has been
  shared in plaintext.
```
