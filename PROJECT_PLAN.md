# In-House Timesheet Application — Master Plan
Prepared for checkpoint review | Draft v1 | 2026-07-06

---

## 0. Build vs. Buy — Re-validated

Re-checked the open-source landscape (Kimai, Solidtime, Anuko, Super Productivity) against the Day-1 proposal's findings. Conclusion unchanged: **build custom**.

- Kimai/Solidtime model allocation as binary "assigned to project" + free-text time entries. Neither has a first-class **allocation percentage** field or a **date-ranged, multi-block allocation** table — you'd be bolting a second data model onto theirs.
- None enforce "approver ≠ employee" as a hard constraint — it's just convention/manual assignment in their UI.
- None have a Keka-ID-preserving import path; you'd write the same migration script regardless of which base you pick.
- Kimai is worth **stealing ideas from** (its permission/role system, invoice/report exports, plugin architecture) but not worth forking — Symfony/PHP is a second stack to maintain alongside whatever the team already knows.

**Decision: custom build, JS/TS stack, PostgreSQL.** Revisit only if timeline pressure forces an MVP-by-config approach.

---

## 1. Tech Stack (core — what's needed to run the full timesheet app)

This is only what's required to get every core timesheet function working end-to-end: org structure, allocation, timesheet entry, and approvals. Nothing here assumes a server or a deployment.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | Component-driven, fast to theme, matches Stitch MCP export format |
| API | Next.js API Routes — same repo as the frontend | One codebase, one deploy, no separate service to stand up |
| ORM | Prisma | Type-safe schema, migrations, straightforward Postgres support |
| Database | PostgreSQL | Relational integrity, check constraints/triggers, date-range queries for allocation logic |
| Auth | NextAuth (credentials: email + password) | Simplest path; SSO/Keka account linking can come later if needed |
| UI Design | **Stitch MCP** (Google Stitch via MCP in Claude Code) | Generate screen mockups, export as HTML/Tailwind, adapt into shadcn/ui components — see §5 |

That's the whole stack for a fully functional local build. Everything else — file handling, notifications, deployment, CI/CD, and every extra infra piece — is listed once, together, below, so it's not mixed into the core plan.

---

## 1a. Everything else — deferred, not part of the current plan

Grouped in one place so the core plan above stays about function, not infrastructure. None of this is needed to build or locally test the full timesheet app (org structure → allocation → timesheet → approval).

| Item | Deferred to |
|---|---|
| File handling for Keka import uploads | Phase 4 (Keka Migration, §6) — local disk is fine when it's built, no S3/MinIO needed |
| Notifications (beyond the `notifications` table already in the schema) | Post-core — table exists in §3, but no queue, UI panel, or delivery mechanism yet |
| Deployment infra (VPS, Nginx, PM2/Docker Compose, HTTPS, backups) | Phase 6 (Deploy & Cutover, §9) — full detail already captured in §7 for when it's time |
| CI/CD | Phase 6+ — manual deploy is fine until then |
| Redis/BullMQ, PgBouncer, tRPC, Sentry/Prometheus/Grafana, S3, k6 load testing | Post-launch, only if real usage shows a need |

---

## 1b. Local Dev / Today's Build Plan (no deployment concerns)

Machine check: Node v24 and Docker are available locally; no native Postgres install — so Postgres runs as a Docker container instead of installing it directly. Nothing below touches a server; it's all `localhost`.

**Local stack for today:**
- Postgres via `docker run`/`docker compose` (single container, mapped to `localhost:5432`) — no need for the app itself to be containerized yet, just the DB.
- Next.js app run with `npm run dev` directly on the host (fast refresh, no Docker overhead for the app while iterating).
- Prisma pointed at the local Postgres container via `DATABASE_URL` in `.env.local`.
- Seed script with a handful of fake employees/clients/projects (including at least one PM allocated to two projects, and one PM whose own timesheet needs a secondary approver) so every role/flow can be clicked through without needing the real Keka export yet.
- Auth: simple email+password (NextAuth credentials) seeded with one login per role — no SSO, no email verification, nothing that needs a mail server.

**Build order for today (foundations → thin vertical slice, matches §9 Phase 1–2 but scoped to "runs locally"):**
1. Scaffold Next.js + TypeScript + Tailwind + shadcn/ui, add Prisma, write `schema.prisma` from §3.
2. Start Postgres in Docker, run `prisma migrate dev`, confirm tables + constraints (allocation cap trigger, self-approval check) actually get created.
3. Seed script: clients → projects → tasks → employees (with role + reportingManagerId) → a couple of allocations.
4. Auth + role-aware routing shell: login, then redirect to the right dashboard per role (Employee/PM/HR Admin/Timesheet Admin).
5. Timesheet Admin: Client/Project/Task CRUD screens (plain forms/tables, no Stitch styling yet).
6. Timesheet Admin: Allocation screen — create/edit allocation with % + date range, see the 100%-cap rejection actually fire.
7. Employee: weekly timesheet grid — save draft, submit, see the 8-hr validation fire.
8. Project Manager: approval queue — approve/reject with comments, confirm the self-approval block actually stops a PM approving their own row, confirm rejected sheet re-opens for the employee.
9. HR Admin: a basic status view (counts of draft/submitted/missing) — enough to sanity-check the data, not the polished dashboard from §5 yet.

**What "done for today" looks like:** you can log in as each of the 4 seeded users, and walk through Client→Project→Task→Allocation→Timesheet→Approval end-to-end on `localhost`, hitting the real Postgres schema — proving out the schema and the business rules (allocation cap, 8-hr minimum, self-approval block) before any UI polish (Stitch) or deployment work happens.

**Explicitly not part of today:** Stitch-designed UI (plain/functional styling only for now), Keka import wizard, notifications, deployment/VPS, CI/CD. These stay queued per the §9 roadmap.

---

## 2. Roles & Permission Matrix

Four roles (matches Day-1 doc, plus a note on the self-approval problem):

| Resource | Employee | Project Manager | HR Admin | Timesheet Admin |
|---|---|---|---|---|
| Log timesheet | Own only | Own only | No | No |
| Save draft (hidden from all but HR Admin + self) | Own only | Own only | Read (support) | No |
| Submit / resubmit timesheet | Own only | Own only | No | No |
| Approve/reject timesheet | No | Assigned team only | No | No |
| Manage Clients/Projects/Tasks | No | No | No | Read & Write |
| Manage Allocations | No | Read only | No | Read & Write |
| Onboard/Offboard staff | No | No | Read & Write | No |
| Legacy (Keka) data import | No | No | No | Read & Write |
| View org-wide timesheet status | No | Own team | Read (all) | Read (all) |
| Assign approver / delegate approval | No | No | No | Read & Write |

**Self-approval fix:** every `Employee` has a `reportingManagerId` (default approver). For employees whose default approver would be themselves (PMs approving their own team including their own row) or during a manager's leave, Timesheet Admin sets an explicit `approverOverrideId`. At submission time the system resolves `approverId = COALESCE(approverOverrideId, reportingManagerId)` and **writes it onto the `TimesheetHeader` row** (denormalized, immutable per week) — plus a DB check constraint `approved_by_id <> employee_id`. This guarantees no self-approval even if the org chart changes later, and gives an audit-safe record of who was actually responsible for each week.

---

## 3. Database Schema

```sql
-- ── Identity ──────────────────────────────────────────────
CREATE TYPE employee_role AS ENUM ('EMPLOYEE','PROJECT_MANAGER','HR_ADMIN','TS_ADMIN');

CREATE TABLE employees (
  id                    VARCHAR PRIMARY KEY,        -- = Keka Employee ID, no regeneration
  name                  VARCHAR NOT NULL,
  email                 VARCHAR UNIQUE NOT NULL,
  phone                 VARCHAR,
  role                  employee_role NOT NULL DEFAULT 'EMPLOYEE',
  reporting_manager_id  VARCHAR REFERENCES employees(id),
  approver_override_id  VARCHAR REFERENCES employees(id),   -- used for PMs / delegated approval
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  keka_legacy_id        VARCHAR UNIQUE,              -- redundant safety net, same as id normally
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Client / Project / Task hierarchy ────────────────────
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id),
  name        VARCHAR NOT NULL,
  code        VARCHAR UNIQUE,           -- e.g. "POL-112", used in Keka mapping
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),
  name        VARCHAR NOT NULL,          -- e.g. "Design", "Dev", "QA", "Admin/Overhead"
  is_default_template BOOLEAN NOT NULL DEFAULT FALSE, -- auto-added when project is created
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Allocation ────────────────────────────────────────────
CREATE TABLE project_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id),
  employee_id           VARCHAR NOT NULL REFERENCES employees(id),
  allocation_percentage INTEGER NOT NULL CHECK (allocation_percentage BETWEEN 5 AND 100)
                          AND (allocation_percentage % 5 = 0),   -- 5% increments
  start_date            DATE NOT NULL,
  end_date              DATE,            -- NULL = open-ended
  created_by            VARCHAR REFERENCES employees(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
-- Staggered allocation = multiple rows for same (employee, project) with non-overlapping date ranges.
-- Overlap/100% cap enforced by trigger below, not a simple UNIQUE constraint (ranges make this non-trivial).

CREATE INDEX idx_allocation_employee_dates ON project_allocations (employee_id, start_date, end_date);

-- Trigger (pseudocode, implemented as PL/pgSQL function + AFTER INSERT/UPDATE trigger):
--   For the affected employee_id, walk all allocation rows whose [start_date,end_date] ranges
--   intersect the new/changed row's range, SUM(allocation_percentage) day-by-day (using generate_series
--   or range-overlap grouping), and RAISE EXCEPTION if any day's sum > 100.

-- ── Timesheets ────────────────────────────────────────────
CREATE TYPE timesheet_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED');

CREATE TABLE timesheet_headers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         VARCHAR NOT NULL REFERENCES employees(id),
  week_start_date     DATE NOT NULL,          -- always a Monday
  status              timesheet_status NOT NULL DEFAULT 'DRAFT',
  approved_by_id      VARCHAR REFERENCES employees(id),  -- resolved approver, set at submit time
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  rejection_comments  TEXT,
  total_hours         NUMERIC(5,2),           -- denormalized cache, recomputed on save
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, week_start_date),
  CHECK (approved_by_id IS NULL OR approved_by_id <> employee_id)
);

CREATE TABLE timesheet_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_header_id UUID NOT NULL REFERENCES timesheet_headers(id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES tasks(id),
  work_date         DATE NOT NULL,
  hours             NUMERIC(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  notes             TEXT,
  UNIQUE (timesheet_header_id, task_id, work_date)
);
CREATE INDEX idx_lines_header ON timesheet_lines (timesheet_header_id);

-- Application-level (not DB) validation on submit: for each work_date in the week,
-- SUM(hours) across all lines >= 8. Kept at app level because the "minimum 8 hours"
-- rule may need exceptions (holidays, approved leave) that are easier to manage in code.

CREATE TABLE approval_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_header_id UUID NOT NULL REFERENCES timesheet_headers(id),
  actor_id            VARCHAR NOT NULL REFERENCES employees(id),
  action              VARCHAR NOT NULL,   -- SUBMITTED | APPROVED | REJECTED | RESUBMITTED
  comments            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Notifications ─────────────────────────────────────────
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  VARCHAR NOT NULL REFERENCES employees(id),
  type         VARCHAR NOT NULL,   -- PENDING_TIMESHEET | APPROVED | REJECTED | APPROVAL_REQUIRED
  payload      JSONB,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Keka migration staging ────────────────────────────────
CREATE TABLE keka_import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     VARCHAR NOT NULL,
  imported_by   VARCHAR REFERENCES employees(id),
  status        VARCHAR NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | DONE | FAILED
  row_count     INTEGER,
  error_count   INTEGER,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE TABLE keka_import_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES keka_import_batches(id),
  row_number    INTEGER,
  raw_row       JSONB,
  error_message TEXT
);

-- ── Audit ─────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    VARCHAR REFERENCES employees(id),
  entity      VARCHAR NOT NULL,     -- 'project', 'allocation', 'employee', etc.
  entity_id   VARCHAR NOT NULL,
  action      VARCHAR NOT NULL,     -- CREATE | UPDATE | DELETE
  diff        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key integrity rules implemented above:**
1. Allocation % in 5% steps, 5–100, capped at 100% total per employee per day (trigger).
2. Staggered allocation = natural consequence of multiple date-ranged rows — no schema change needed beyond what's already there.
3. PM self-approval blocked by CHECK constraint on the resolved `approved_by_id`, not the org-chart field, so it can't be bypassed by editing `reporting_manager_id` later.
4. Draft timesheets are visible only to the employee + HR Admin — enforced in the API authorization layer (row-level filtering by role + `status`), not in SQL RLS (simpler to reason about at this scale, revisit if you later expose direct DB access).
5. Weekly uniqueness (`employee_id, week_start_date`) prevents duplicate timesheet headers.

---

## 4. Backend / API Structure

Module boundaries (whether implemented as Next.js route handlers or NestJS modules):

- `auth` — login, session, password reset, (future SSO)
- `employees` — CRUD, activate/deactivate, Keka ID mapping, role assignment
- `clients` — CRUD
- `projects` — CRUD, default task templates
- `tasks` — CRUD per project
- `allocations` — create/edit/end allocation, overlap validation, utilization queries
- `timesheets` — save draft, submit, list (own/team/all depending on role), get by week
- `approvals` — approve/reject with comments, approval history
- `notifications` — list, mark read, generation triggers (cron: pending reminders)
- `reports` — HR/Admin dashboards: submitted/draft/missing counts by week/month, utilization
- `migration` — upload Keka export, parse, dry-run validation report, commit import

API pattern: plain REST-style Next.js API routes (e.g. `POST /api/timesheets/[id]/submit`, `POST /api/approvals/[id]/approve`) returning JSON — no extra framework needed for this scope.

Authorization: a shared helper resolves `session.role` + `session.employeeId` on every route, then each handler enforces the matrix in §2 (e.g., the approve route checks the target timesheet's `employeeId` is in the caller's allocated-team set before allowing the action).

---

## 5. Frontend / UI Plan (using Stitch MCP)

Stitch (Google Labs) now ships an official MCP server (`stitch-mcp`) that Claude Code can call directly — confirmed current as of mid-2026. Workflow:

1. **Design pass per screen**: prompt Stitch (via MCP, from inside Claude Code) with a screen brief — e.g. "Employee weekly timesheet grid, days Mon–Sun as columns, tasks as rows, daily/weekly totals, save-draft and submit buttons, dark-on-light SaaS style." Stitch generates the mockup.
2. **Export**: use the MCP's `get_screen_code` / `build_site` tools to pull the generated HTML/Tailwind for that screen straight into the repo.
3. **Componentize**: refactor the exported markup into shadcn/ui primitives (Table, Card, Dialog, Badge, Select) so it stays consistent with the rest of the app and is easy to wire to real data/state — don't ship Stitch's raw HTML as-is.
4. **Wire up**: connect to tRPC/API hooks, add loading/error/empty states Stitch won't generate for you.

Screens to generate this way (mirrors the four mockups already in the Day-1 deck, expanded):

| Role | Screens |
|---|---|
| Employee | Weekly timesheet grid, submission history/status, notifications panel, profile |
| Project Manager | Team approval queue, timesheet detail/review modal, my-allocations (read-only), own timesheet entry |
| HR Admin | Staff directory (onboard/offboard, Keka ID mapping), org-wide status dashboard (submitted/draft/missing by week & month), CSV/Excel import wizard |
| Timesheet Admin | Client/Project/Task management, allocation board (Gantt-style timeline like the Day-1 mockup), utilization charts, Keka migration tool |

Because Stitch output is HTML/Tailwind, it drops into Next.js cleanly; the main integration cost is the componentization step (3), which should be budgeted explicitly per screen rather than assumed to be free.

---

## 6. Keka Migration Plan

1. Obtain from Keka: employee export (ID, name, email, phone, manager), client list, project list, historical timesheet export (Excel/CSV).
2. Build a **dry-run importer**: parses the files, maps rows to the schema above, and produces a validation report (`keka_import_errors`) *without* committing — surfaced in the Timesheet Admin UI before commit.
3. Employee IDs are inserted verbatim as the PK (`employees.id`) — no regeneration, per the hard requirement.
4. Historical timesheets import as `APPROVED` status headers/lines with `approved_by_id` backfilled from Keka's approval data where available, else left null with a `LEGACY_IMPORT` flag (add a boolean column if Keka data doesn't cleanly map approver info).
5. Run migration against a staging DB first; only promote to prod after Timesheet Admin sign-off on the validation report.

---

## 7. Infrastructure & Deployment (target: 50 concurrent users) — basic setup

50 concurrent users doing form-based CRUD is a light load. Keep this to the smallest setup that works:

```
 Users ── HTTPS ──▶  Nginx (reverse proxy, TLS via Let's Encrypt)
                          │
                     Next.js app (PM2 process, or a single Docker container)
                          │
                     PostgreSQL (same VPS)
```

**Sizing:** one VPS, 2 vCPU / 4 GB RAM (Hetzner/DigitalOcean, ~$10–15/mo) is enough to run Next.js + PostgreSQL + Nginx together for 50 concurrent users doing timesheet entry/approval. No load balancer, no separate DB server, no connection pooler needed at this stage — Postgres's default connection limit comfortably covers this.

**Must-haves before go-live (kept minimal):**
- Nightly `pg_dump` cron to a backup file (copied off the VPS — even a simple scheduled copy to cloud storage is enough), tested once by restoring it.
- HTTPS via Let's Encrypt/Certbot.
- `.env` file for secrets, not committed to git.
- The `audit_logs` table from §3 gives you a "who changed what" trail without needing extra tooling.

Everything else in the earlier draft (PgBouncer, Redis, Sentry, staging environment, load testing) is worth doing eventually, but isn't a blocker for a short-timeline launch at this user count — add it once the app is live and you see where the actual pressure is.

---

## 8. Testing Strategy — basic

Given the timeline, focus testing effort on the rules that are easy to get subtly wrong, and rely on manual QA for the rest:

- Unit tests for the three risky pieces of business logic: allocation overlap/100% cap, minimum-8-hours validation, approver resolution (self-approval block).
- Manual QA pass through the four core flows before each phase is called done: employee submit, manager approve/reject, admin allocate, HR import.
- Formal E2E automation (Playwright) and load testing (k6) are worth adding later, but can wait until after launch given the short timeline.

---

## 9. Phased Roadmap — compressed for a short timeline

Fewer, larger phases. Each one ships something usable rather than being split into infra-vs-feature work.

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 — Discovery (done) | Requirements, role matrix, Keka export samples | Signed off at checkpoint call |
| 1 — Foundations + org structure | Repo scaffold, auth, DB schema, Client/Project/Task CRUD, Employee onboarding | Admin can log in and build a full client→project→task→employee tree; each role sees its own dashboard shell |
| 2 — Allocation + timesheet core | Allocation CRUD (partial %, staggered ranges, 100% cap), weekly timesheet grid (save draft, submit, 8-hr check) | Employee can be allocated across projects and submit a valid week; over-allocation is rejected |
| 3 — Approvals + reporting | Approve/reject with comments, resubmission loop, self-approval block, HR/Admin status dashboard | Full submit → approve/reject → resubmit loop works end-to-end; HR can see org-wide status |
| 4 — Keka migration | Import wizard, dry-run validation, commit | Historical data loaded with correct legacy IDs |
| 5 — UI pass (Stitch) | Run role screens through Stitch MCP, adapt into shadcn components | App matches/exceeds the Day-1 mockups visually |
| 6 — Deploy & cutover | VPS setup, backups, HTTPS, pilot with real users alongside Keka | Sign-off from Anshika/Bhavya, cutover date set |

Post-launch: bug fixes and any deferred infra (monitoring, load testing, notifications queue) added as real usage dictates, not upfront.

---

## 10. Open Questions for Tomorrow's Checkpoint

- Who is the designated **secondary approver** for each Project Manager (per-PM assignment, or a single fallback like a Delivery Head)?
- What happens on **public holidays / approved leave** — does the "minimum 8 hrs/day" rule need an exception path, or is leave logged as its own task type?
- Is there an **overtime** concept (>8 hrs/day), and does it need separate tracking/approval?
- Is there a **cap on rejection/resubmission cycles**, or an escalation if a timesheet bounces repeatedly?
- Do historical Keka timesheets need **approver identity preserved**, or is a generic "Legacy Import" tag acceptable if Keka's export doesn't cleanly include it?
- Any requirement for **billable vs. non-billable** hour distinction (client invoicing use case), or is this purely internal tracking for now?
- Timezone handling — is the org single-timezone, or do "Monday" week boundaries need to account for multiple offices?

---
*Companion doc to `timesheet_project_presentation.pdf` (Day 1 proposal by Rohit & Mehul).*
