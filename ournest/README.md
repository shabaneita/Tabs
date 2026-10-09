# بيتنا — OurNest Finance

An Arabic-only, RTL-first personal and household finance PWA for a married couple in Dubai. Each spouse has their own account and private workspace. They share one household with a common budget, expenses, bills, installments and savings goals.

- **UI:** Arabic only, native RTL, light and dark themes, built for iPhone Safari and installable to the home screen.
- **Currency and time:** AED, stored as integer fils (no floating point). Dubai civil dates.
- **Privacy:** enforced by PostgreSQL Row Level Security, not by hiding UI. A spouse's private records never reach the other spouse's browser.

> The repository root also contains an older, unrelated Xamarin project (`Tabs/`). OurNest lives entirely in this `ournest/` folder.

---

## What's included

| Area | Status |
|---|---|
| Email/password auth, sign-up, password reset (email links) | ✅ |
| Household creation, secure email-bound invitations (hashed tokens, 7-day expiry, max 2 members) | ✅ |
| Shared vs private records with equal permissions on shared data | ✅ (RLS + triggers, tested) |
| Expense entry in 3 steps (amount → category → save), custom keypad, duplicate warning, idempotent saves, undo | ✅ |
| Expenses: edit/delete, search (12 months), filters (all / household / mine, category, who added), receipts, payment methods, accounts | ✅ |
| Monthly household budget (template 14,000 AED / 13,175 planned / 825 unallocated), fully editable, auto-copied to new months | ✅ |
| Household contributions (declared amounts, never derived from income) | ✅ |
| Private income (salary, freelance, bonus, other) | ✅ owner-only, no visibility column at all |
| Recurring bills: weekly/monthly/quarterly/yearly rules, reminders, overdue, timeline, calendar, pay-once guarantee | ✅ |
| Installments: balance, history, remaining count, completion date, early payoff simulation, budget impact | ✅ |
| Savings goals (shared and private): deposits/withdrawals, completion estimates, required monthly amount | ✅ |
| Rule-based insights with "how we calculated this" explanations | ✅ |
| Analytics: donut, monthly bars, cumulative trend vs budget pace, budget vs actual, cash flow, recurring breakdown, goals, monthly and yearly reports | ✅ |
| CSV export (UTF-8 BOM, formula-injection safe) and print-perfect Arabic PDF report | ✅ |
| Activity feed and in-app notifications (shared expenses, bills, budget warnings, installments) | ✅ |
| Custom categories and subcategories, private categories, accounts, personal notes, settings, privacy page | ✅ |
| PWA: manifest, icons, Apple meta, safe areas, service worker, offline page | ✅ |
| Offline transaction sync | ❌ Not implemented on purpose. The service worker caches only the app shell, never financial data. |
| Push notifications outside the app | ❌ Not implemented. Notifications appear in-app when it is opened. |

---

## Tech stack

Next.js 16 (App Router, `proxy.ts`) · TypeScript · Tailwind CSS v4 · shadcn-style components built on Radix and vaul · Lucide · Motion · Recharts · Supabase (Postgres, Auth, Storage, RLS) · React Hook Form + Zod · TanStack Query · date-fns + @date-fns/tz · Vitest · Playwright · IBM Plex Sans Arabic (self-hosted via Fontsource).

### Architecture in one paragraph

All data access goes from the browser through `@supabase/supabase-js` using the **anon key plus the user's JWT**. Postgres RLS decides what each request may read or write. Multi-step operations run as Postgres functions (`create_household`, `create_invitation`, `accept_invitation`, `ensure_month_budget`, `record_installment_payment`). The proxy only refreshes the session cookie and does optimistic redirects. **There is no service-role key anywhere in the app.** All finance maths (budget, bills, installments, savings, insights, analytics) is pure TypeScript in `src/lib/finance/`, unit-tested, and runs on already-authorized rows.

```
src/
  app/                 routes (Arabic UI); (app)/ = authenticated shell, (auth)/ = sign-in pages
  components/          design system (ui/), dashboard widgets, expense entry, charts
  lib/finance/         pure, tested business logic
  lib/data/            TanStack Query hooks over Supabase
  proxy.ts             session refresh + optimistic routing (not a security boundary)
supabase/migrations/   schema, RLS, functions, storage policies, template data
scripts/local-stack/   Docker-free Supabase-compatible stack for tests
tests/unit | db | e2e  Vitest unit, Vitest+pg RLS suite, Playwright iPhone E2E
```

---

## Privacy model

Every visibility-aware table (`transactions`, `categories`, `financial_accounts`, `recurring_bills`, `installment_plans`, `savings_goals`) has `household_id`, `owner_id` and `visibility ∈ {shared, private}`.

- **Read:** shared rows are visible to any member of the household. Private rows are visible to the owner only.
- **Write:** shared rows can be written by any member (equal permissions). Private rows can be written by the owner only. `owner_id` and `household_id` are immutable, and only the owner can change `visibility` (so a spouse can't hide or claim the other's records).
- **Child rows** (installment payments, savings contributions, receipts) inherit access from their parent through RLS sub-queries.
- **Referential privacy:** a shared record can't point at a private category, account, bill or plan, so a spouse never receives a pointer into private data.
- **Owner-only tables:** `income_sources`, `personal_notes`, `user_settings`, `notifications`.
- **Derived data:** the activity log and partner notifications are written by triggers **only for shared records**. When a record becomes private, its earlier log and notification traces are deleted. Household budget, analytics and insights use shared rows only (filtered again in code as defence in depth). Reminder notifications are derived only from rows the recipient can already read.
- **Budget ≠ income:** the household budget is an allocation the couple types in. Contributions are declared amounts. Nothing is computed from income.
- **Receipts:** a private `receipts` bucket. Upload requires write access to the transaction, and reading requires a visible `receipt_attachments` row. Files are served through 60-second signed URLs.
- **Invitations:** only a SHA-256 hash of the token is stored, and the hash column is not selectable. Accepting requires the invited email, an unexpired invitation and a free seat.

These rules are verified by **`tests/db/privacy.test.ts`**, 33 tests that run real SQL as each spouse and as an outsider.

---

## Local development

Prerequisites: Node 22+, and either the Supabase CLI with Docker, **or** a local PostgreSQL 16 install for the Docker-free stack.

### Option A — Supabase CLI (Docker)

```bash
cd ournest
npm install
supabase start                       # applies supabase/migrations
cp .env.example .env.local           # use the API URL + anon key printed by `supabase start`
npm run dev
```

### Option B — Docker-free stack (what CI and the tests use)

```bash
cd ournest
npm install
npm run stack:start                  # Postgres + GoTrue (Supabase Auth) + PostgREST on :54321
grep NEXT_PUBLIC .local-stack/env > .env.local
npm run dev                          # http://localhost:3000
# optional demo couple with realistic data (local only):
node --env-file=.local-stack/env scripts/seed-local-demo.mjs
npm run stack:stop                   # add --reset to wipe the database
```

The Docker-free stack doesn't emulate **Storage**, so receipt upload needs Option A or a real project. Email confirmation is auto-approved locally.

---

## Tests

```bash
npm run typecheck
npm test                 # unit tests + DB privacy tests (DB suite needs TEST_DATABASE_URL)
set -a; source .local-stack/env; set +a; npm test   # run both with the local stack
npm run build && npm run test:e2e                     # Playwright, iPhone 15 viewport, ar-AE, Asia/Dubai
```

Latest local results:

- **Unit:** 72 tests. Money parsing/formatting without float drift, Dubai dates, Arabic plurals, budget maths, bill recurrence (month-end anchors, statuses, no double counting), installments and early payoff, savings, income, insights (including privacy), analytics scopes, CSV, keypad.
- **Database privacy/authorization:** 33 tests against the real migrations.
- **E2E (Playwright):** 22 tests. Two-spouse sign-up, invitation and acceptance. Shared and private expenses with UI privacy checks. Budget totals. Notifications and activity. Theme persistence. No horizontal overflow. Bills paid once. Installment payments and payoff simulation. Goals. CSV download. PDF rendering. PWA manifest, meta and service worker. No theme flash before hydration. axe-core WCAG 2 A/AA scans of key screens in light and dark.

> E2E runs in Chromium with iPhone 15 metrics because WebKit isn't available in the CI image. Do a final manual pass in real iPhone Safari before launch.

---

## Deploying (Supabase + Vercel)

### 1. Supabase project

1. Create a project (region close to the UAE, e.g. *Middle East (Bahrain)* or *Europe (Frankfurt)*).
2. Apply the migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push           # runs everything in supabase/migrations
   ```
   (Or paste each file in `supabase/migrations/` in order into the SQL editor.)
3. **Authentication → Providers → Email:** enable email sign-up, keep *Confirm email* on, set *minimum password length* to **8**.
4. **Authentication → URL configuration:**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/confirm`
5. **Authentication → Email templates** (recommended for SSR): point the *Confirm signup* and *Reset password* links to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}`.
   The default `?code=` links also work through `/auth/callback`.
6. **SMTP:** configure a custom SMTP provider for production email (the built-in sender is heavily rate-limited).
7. **Storage:** the migration creates the private `receipts` bucket and its policies. Confirm it shows as *Private*.
8. **API settings:** keep the *Data API* exposing only `public`. The migrations revoke table access from `anon`.

### 2. Vercel

1. Import the GitHub repo and set **Root Directory = `ournest`** (Framework: Next.js).
2. Environment variables (Production and Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon / publishable key |
   **Do not** add the service-role key. The app doesn't need it.
3. Deploy, then add your custom domain and update the Supabase Site URL and redirect URL to match.
4. Without the two variables, every page shows an Arabic "setup required" screen instead of crashing.

### 3. Install on iPhone

Open the site in **Safari** → Share → **Add to Home Screen** → open **بيتنا** from the home screen. It runs full-screen with safe-area support. The session persists in the standalone app.

### Production checklist

- [ ] Custom SMTP configured; confirmation and reset emails tested on a phone
- [ ] Both spouses created accounts with the invited email addresses
- [ ] Budget template reviewed and edited for the first month
- [ ] Receipt upload tested against the real Storage bucket
- [ ] Final manual pass in iPhone Safari (light and dark) and from the home screen
- [ ] Supabase backups (PITR) enabled for a finance database

---

## Notes and known limitations

- Reminders are generated when the app is opened (no server cron or push). A `pg_cron` job could call the same rules later.
- Month budgets are created lazily: opening a new month copies the latest budget (`ensure_month_budget`).
- Installment plans model a fixed total payable. The early-payoff simulation reports time saved, not interest saved.
- A user can belong to one household. Joining another is only allowed from an empty solo household.
- The PDF report uses the browser's print engine ("Save as PDF"), which renders Arabic shaping and RTL correctly. On iPhone: Share → Print → Share as PDF.
