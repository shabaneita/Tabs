/**
 * Database-level privacy & authorization tests.
 *
 * These run real SQL as the `authenticated` role with Supabase-style JWT
 * claims, so every assertion exercises the actual RLS policies, triggers
 * and RPCs from supabase/migrations. Requires TEST_DATABASE_URL (see
 * scripts/local-stack/start.sh); skipped otherwise.
 */
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

type User = { id: string; email: string; name: string };

let pool: Pool;
const run = randomUUID().slice(0, 8);
const mk = (name: string): User => ({ id: randomUUID(), email: `${name}-${run}@test.dev`, name });
const husband = mk("husband");
const wife = mk("wife");
const outsider = mk("outsider");
const stranger = mk("stranger");

async function as<T>(user: User | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (user) {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
    } else {
      await c.query("set local role anon");
    }
    const result = await fn(c);
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

const q = async (user: User | null, sql: string, params: unknown[] = []) =>
  as(user, async (c) => (await c.query(sql, params)).rows);

const one = async (user: User | null, sql: string, params: unknown[] = []) => (await q(user, sql, params))[0];

const expectError = async (p: Promise<unknown>, pattern: RegExp) => {
  await expect(p).rejects.toThrow(pattern);
};

let householdId: string;
let otherHouseholdId: string;
let sharedCategoryId: string;
let diningCategoryId: string;

d("privacy & authorization (RLS)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    for (const u of [husband, wife, outsider, stranger]) {
      await pool.query(
        `insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(), now())`,
        [u.id, u.email, JSON.stringify({ display_name: u.name })],
      );
    }
    householdId = (await one(husband, "select public.create_household('بيتنا') as id")).id;
    const token = (await one(husband, "select public.create_invitation($1) as t", [wife.email.toUpperCase()])).t;
    await one(wife, "select public.accept_invitation($1)", [token]);
    otherHouseholdId = (await one(outsider, "select public.create_household('بيت آخر') as id")).id;

    const cats = await q(husband, "select id, system_key from public.categories where household_id = $1", [householdId]);
    sharedCategoryId = cats.find((c) => c.system_key === "groceries").id;
    diningCategoryId = cats.find((c) => c.system_key === "dining").id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from public.households where id = any($1)", [[householdId, otherHouseholdId].filter(Boolean)]);
    await pool.query("delete from auth.users where id = any($1)", [[husband, wife, outsider, stranger].map((u) => u.id)]);
    await pool.end();
  });

  describe("household & invitations", () => {
    it("seeds the editable 14,000 AED template with 13,175 AED planned", async () => {
      const b = await one(
        wife,
        `select b.total_allocation_minor::int as total, sum(bi.planned_minor)::int as planned, count(*)::int as n
         from public.budgets b join public.budget_items bi on bi.budget_id = b.id
         where b.household_id = $1 group by b.id`,
        [householdId],
      );
      expect(b).toEqual({ total: 1400000, planned: 1317500, n: 11 });
    });

    it("both spouses see each other's display name, outsiders see neither", async () => {
      const names = (await q(wife, "select display_name from public.profiles order by display_name")).map((r) => r.display_name);
      expect(names.sort()).toEqual(["husband", "wife"]);
      const outsiderView = await q(outsider, "select id from public.profiles where id = any($1)", [[husband.id, wife.id]]);
      expect(outsiderView).toHaveLength(0);
    });

    it("keeps user settings private to their owner", async () => {
      const rows = await q(wife, "select user_id from public.user_settings");
      expect(rows.map((r) => r.user_id)).toEqual([wife.id]);
    });

    it("never exposes invitation token hashes", async () => {
      await expectError(q(husband, "select token_hash from public.invitations"), /permission denied/);
    });

    it("rejects a third member (household capacity is two)", async () => {
      await expectError(q(husband, "select public.create_invitation($1)", [stranger.email]), /household_full/);
    });

    it("rejects invitations accepted by a different email", async () => {
      const token = (await one(outsider, "select public.create_invitation($1) as t", ["someone@test.dev"])).t;
      await expectError(q(stranger, "select public.accept_invitation($1)", [token]), /invitation_email_mismatch/);
    });

    it("rejects expired invitations", async () => {
      const token = (await one(outsider, "select public.create_invitation($1) as t", [stranger.email])).t;
      await pool.query("update public.invitations set expires_at = now() - interval '1 minute' where household_id = $1 and status = 'pending'", [otherHouseholdId]);
      await expectError(q(stranger, "select public.accept_invitation($1)", [token]), /invitation_expired/);
    });

    it("hides households, members and budgets from outsiders", async () => {
      expect(await q(outsider, "select id from public.households where id = $1", [householdId])).toHaveLength(0);
      expect(await q(outsider, "select user_id from public.household_members where household_id = $1", [householdId])).toHaveLength(0);
      expect(await q(outsider, "select id from public.budgets where household_id = $1", [householdId])).toHaveLength(0);
      expect(await q(outsider, "select id from public.categories where household_id = $1", [householdId])).toHaveLength(0);
    });

    it("gives the anonymous role no table access at all", async () => {
      await expectError(q(null, "select * from public.transactions"), /permission denied/);
      await expectError(q(null, "select * from public.profiles"), /permission denied/);
      await expectError(q(null, "select public.create_household('x')"), /permission denied/);
    });
  });

  describe("transactions", () => {
    let sharedTx: string;
    let privateTx: string;

    beforeAll(async () => {
      sharedTx = (
        await one(
          husband,
          `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, description)
           values ($1, 'shared', 12500, $2, '2026-10-05', 'كارفور') returning id`,
          [householdId, sharedCategoryId],
        )
      ).id;
      privateTx = (
        await one(
          husband,
          `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, description)
           values ($1, 'private', 99900, $2, '2026-10-05', 'هدية سرية') returning id`,
          [householdId, sharedCategoryId],
        )
      ).id;
    });

    it("shows shared expenses to both spouses but private ones only to the owner", async () => {
      const wifeIds = (await q(wife, "select id from public.transactions")).map((r) => r.id);
      expect(wifeIds).toContain(sharedTx);
      expect(wifeIds).not.toContain(privateTx);
      const husbandIds = (await q(husband, "select id from public.transactions")).map((r) => r.id);
      expect(husbandIds).toEqual(expect.arrayContaining([sharedTx, privateTx]));
    });

    it("excludes private amounts from every derived total the spouse can compute", async () => {
      const total = await one(wife, "select coalesce(sum(amount_minor), 0)::int as s, count(*)::int as n from public.transactions");
      expect(total).toEqual({ s: 12500, n: 1 });
      const byId = await q(wife, "select id from public.transactions where id = $1", [privateTx]);
      expect(byId).toHaveLength(0);
    });

    it("hides everything from another household", async () => {
      expect(await q(outsider, "select id from public.transactions where household_id = $1", [householdId])).toHaveLength(0);
    });

    it("lets either spouse edit shared expenses (equal permissions)", async () => {
      const rows = await q(wife, "update public.transactions set amount_minor = 13000 where id = $1 returning id", [sharedTx]);
      expect(rows).toHaveLength(1);
    });

    it("blocks the spouse from editing or deleting private expenses", async () => {
      expect(await q(wife, "update public.transactions set amount_minor = 1 where id = $1 returning id", [privateTx])).toHaveLength(0);
      expect(await q(wife, "delete from public.transactions where id = $1 returning id", [privateTx])).toHaveLength(0);
      const still = await one(husband, "select amount_minor::int as a from public.transactions where id = $1", [privateTx]);
      expect(still.a).toBe(99900);
    });

    it("prevents the spouse from hiding or claiming a shared record", async () => {
      await expectError(q(wife, "update public.transactions set visibility = 'private' where id = $1", [sharedTx]), /only_owner_can_change_visibility|row-level security/);
      await expectError(q(wife, "update public.transactions set owner_id = $2 where id = $1", [sharedTx, wife.id]), /owner_immutable/);
    });

    it("prevents inserting records on behalf of the other spouse or another household", async () => {
      await expectError(
        q(wife, `insert into public.transactions (household_id, owner_id, visibility, amount_minor, category_id, occurred_on)
                 values ($1, $2, 'private', 100, $3, '2026-10-05')`, [householdId, husband.id, sharedCategoryId]),
        /row-level security/,
      );
      await expectError(
        q(outsider, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on)
                     values ($1, 'shared', 100, $2, '2026-10-05')`, [householdId, sharedCategoryId]),
        /row-level security|category_not_in_household/,
      );
    });

    it("rejects double submission with the same idempotency key", async () => {
      const key = randomUUID();
      const sql = `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, client_request_id)
                   values ($1, 'shared', 500, $2, '2026-10-06', $3)`;
      await q(wife, sql, [householdId, diningCategoryId, key]);
      await expectError(q(wife, sql, [householdId, diningCategoryId, key]), /transactions_client_request_unique/);
    });
  });

  describe("activity log & notifications", () => {
    it("notifies the spouse about shared expenses only", async () => {
      const shared = (
        await one(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, description)
          values ($1, 'shared', 4200, $2, '2026-10-07', 'عشاء') returning id`, [householdId, diningCategoryId])
      ).id;
      const priv = (
        await one(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, description)
          values ($1, 'private', 7700, $2, '2026-10-07', 'خاص جدا') returning id`, [householdId, diningCategoryId])
      ).id;
      const notes = await q(wife, "select entity_id, kind from public.notifications");
      expect(notes.map((n) => n.entity_id)).toContain(shared);
      expect(notes.map((n) => n.entity_id)).not.toContain(priv);
      const feed = await q(wife, "select entity_id, title from public.activity_logs");
      expect(feed.map((f) => f.entity_id)).toContain(shared);
      expect(feed.map((f) => f.entity_id)).not.toContain(priv);
      expect(JSON.stringify(feed)).not.toContain("خاص جدا");
    });

    it("erases earlier traces when a shared record becomes private", async () => {
      const id = (
        await one(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, description)
          values ($1, 'shared', 3100, $2, '2026-10-07', 'كان مشترك') returning id`, [householdId, diningCategoryId])
      ).id;
      expect((await q(wife, "select id from public.activity_logs where entity_id = $1", [id])).length).toBeGreaterThan(0);
      await q(husband, "update public.transactions set visibility = 'private' where id = $1", [id]);
      expect(await q(wife, "select id from public.activity_logs where entity_id = $1", [id])).toHaveLength(0);
      expect(await q(wife, "select id from public.notifications where entity_id = $1", [id])).toHaveLength(0);
      expect(await q(wife, "select id from public.transactions where id = $1", [id])).toHaveLength(0);
    });

    it("keeps notifications private to their recipient", async () => {
      const husbandSees = await q(husband, "select user_id from public.notifications");
      expect(husbandSees.every((n) => n.user_id === husband.id)).toBe(true);
    });

    it("does not let a user create notifications for someone else", async () => {
      await expectError(
        q(wife, `insert into public.notifications (user_id, household_id, kind, title) values ($1, $2, 'bill_due', 'x')`, [husband.id, householdId]),
        /row-level security/,
      );
      await expectError(
        q(wife, `insert into public.notifications (user_id, household_id, kind, title) values ($1, $2, 'shared_expense', 'x')`, [wife.id, householdId]),
        /row-level security/,
      );
    });

    it("rejects direct writes to the activity log", async () => {
      await expectError(
        q(wife, `insert into public.activity_logs (household_id, action, entity_type) values ($1, 'created', 'x')`, [householdId]),
        /permission denied/,
      );
    });
  });

  describe("private finance", () => {
    it("keeps income visible to its owner only and unshareable", async () => {
      await q(husband, `insert into public.income_sources (household_id, name, kind, amount_minor, starts_on)
                        values ($1, 'الراتب', 'salary', 2500000, '2026-01-01')`, [householdId]);
      expect(await q(wife, "select id from public.income_sources")).toHaveLength(0);
      expect((await one(wife, "select count(*)::int as n from public.income_sources")).n).toBe(0);
      await expectError(
        q(wife, `insert into public.income_sources (owner_id, name, amount_minor, starts_on) values ($1, 'x', 1, '2026-01-01')`, [husband.id]),
        /row-level security/,
      );
    });

    it("separates household contributions from income", async () => {
      await q(husband, `insert into public.household_contributions (household_id, effective_month, monthly_amount_minor)
                        values ($1, '2026-10-01', 900000)`, [householdId]);
      const rows = await q(wife, "select monthly_amount_minor::int as a from public.household_contributions");
      expect(rows).toEqual([{ a: 900000 }]);
      expect(await q(wife, "update public.household_contributions set monthly_amount_minor = 1 returning id")).toHaveLength(0);
    });

    it("keeps personal notes owner-only", async () => {
      await q(husband, "insert into public.personal_notes (title, body) values ('ملاحظة', 'سري')");
      expect(await q(wife, "select id from public.personal_notes")).toHaveLength(0);
    });

    it("keeps private savings goals and their contributions hidden", async () => {
      const goal = (
        await one(husband, `insert into public.savings_goals (household_id, visibility, name, target_minor)
                            values ($1, 'private', 'مفاجأة', 500000) returning id`, [householdId])
      ).id;
      await q(husband, "insert into public.savings_contributions (goal_id, amount_minor, contributed_on) values ($1, 10000, '2026-10-01')", [goal]);
      expect(await q(wife, "select id from public.savings_goals where id = $1", [goal])).toHaveLength(0);
      expect(await q(wife, "select id from public.savings_contributions where goal_id = $1", [goal])).toHaveLength(0);
      await expectError(
        q(wife, "insert into public.savings_contributions (goal_id, amount_minor, contributed_on) values ($1, 5, '2026-10-01')", [goal]),
        /row-level security/,
      );
      expect(await q(wife, "select id from public.activity_logs where entity_id = $1", [goal])).toHaveLength(0);
    });

    it("never lets a shared record point at a private category or account", async () => {
      const privCat = (
        await one(husband, `insert into public.categories (household_id, visibility, name) values ($1, 'private', 'هواياتي') returning id`, [householdId])
      ).id;
      const privAcc = (
        await one(husband, `insert into public.financial_accounts (household_id, visibility, name) values ($1, 'private', 'حسابي') returning id`, [householdId])
      ).id;
      await expectError(
        q(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on) values ($1, 'shared', 100, $2, '2026-10-01')`, [householdId, privCat]),
        /shared_record_needs_shared_category/,
      );
      await expectError(
        q(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, account_id, occurred_on) values ($1, 'shared', 100, $2, $3, '2026-10-01')`, [householdId, sharedCategoryId, privAcc]),
        /shared_record_needs_shared_account/,
      );
      await expectError(
        q(wife, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on) values ($1, 'private', 100, $2, '2026-10-01')`, [householdId, privCat]),
        /shared_record_needs_shared_category/,
      );
      expect(await q(wife, "select id from public.categories where id = $1", [privCat])).toHaveLength(0);
      expect(await q(wife, "select id from public.financial_accounts where id = $1", [privAcc])).toHaveLength(0);
    });

    it("blocks making a category private while shared expenses use it", async () => {
      await expectError(
        q(husband, "update public.categories set visibility = 'private' where id = $1", [sharedCategoryId]),
        /category_in_shared_use/,
      );
    });
  });

  describe("budgets, bills and installments", () => {
    it("lets both spouses edit the shared budget and copies it to new months", async () => {
      const id = (await one(wife, "select public.ensure_month_budget('2026-11-15') as id")).id;
      const items = await one(husband, "select count(*)::int as n, sum(planned_minor)::int as s from public.budget_items where budget_id = $1", [id]);
      expect(items).toEqual({ n: 11, s: 1317500 });
      const upd = await q(wife, "update public.budgets set total_allocation_minor = 1500000 where id = $1 returning id", [id]);
      expect(upd).toHaveLength(1);
      // Idempotent
      expect((await one(husband, "select public.ensure_month_budget('2026-11-01') as id")).id).toBe(id);
    });

    it("rejects budget items for private categories", async () => {
      const privCat = (
        await one(wife, `insert into public.categories (household_id, visibility, name) values ($1, 'private', 'خاص بي') returning id`, [householdId])
      ).id;
      const budget = (await one(wife, "select public.ensure_month_budget('2026-10-01') as id")).id;
      await expectError(
        q(wife, "insert into public.budget_items (budget_id, household_id, category_id, planned_minor) values ($1, $2, $3, 100)", [budget, householdId, privCat]),
        /budget_item_needs_shared_category/,
      );
    });

    it("counts a bill period at most once", async () => {
      const bill = (
        await one(husband, `insert into public.recurring_bills (household_id, name, kind, category_id, amount_minor, anchor_date)
                            values ($1, 'DEWA', 'utilities', $2, 65000, '2026-10-10') returning id`, [householdId, sharedCategoryId])
      ).id;
      const pay = `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on, bill_id, bill_period)
                   values ($1, 'shared', 64000, $2, '2026-10-09', $3, '2026-10-10')`;
      await q(wife, pay, [householdId, sharedCategoryId, bill]);
      await expectError(q(husband, pay, [householdId, sharedCategoryId, bill]), /transactions_one_payment_per_bill_period/);
    });

    it("records installment payments atomically and guards private plans", async () => {
      const instCat = (await one(husband, "select id from public.categories where household_id = $1 and system_key = 'installments'", [householdId])).id;
      const shared = (
        await one(husband, `insert into public.installment_plans (household_id, name, category_id, total_amount_minor, monthly_amount_minor, first_due_date)
                            values ($1, 'تقسيط الثلاجة', $2, 600000, 100000, '2026-10-01') returning id`, [householdId, instCat])
      ).id;
      const pid = (await one(wife, "select public.record_installment_payment($1, 100000, '2026-10-01', '2026-10-01') as id", [shared])).id;
      const pay = await one(husband, "select transaction_id from public.installment_payments where id = $1", [pid]);
      const tx = await one(husband, "select visibility, amount_minor::int as a, owner_id from public.transactions where id = $1", [pay.transaction_id]);
      expect(tx).toEqual({ visibility: "shared", a: 100000, owner_id: wife.id });
      await expectError(q(wife, "select public.record_installment_payment($1, 999999999, '2026-10-02')", [shared]), /amount_exceeds_outstanding/);
      await expectError(q(wife, "select public.record_installment_payment($1, 100000, '2026-10-01', '2026-10-01')", [shared]), /installment_payments_one_per_period/);

      // Deleting the payment removes its expense (no phantom budget spend).
      await q(wife, "delete from public.installment_payments where id = $1", [pid]);
      expect(await q(husband, "select id from public.transactions where id = $1", [pay.transaction_id])).toHaveLength(0);

      const priv = (
        await one(husband, `insert into public.installment_plans (household_id, visibility, name, category_id, total_amount_minor, monthly_amount_minor, first_due_date)
                            values ($1, 'private', 'قرض شخصي', $2, 300000, 50000, '2026-10-01') returning id`, [householdId, instCat])
      ).id;
      await expectError(q(wife, "select public.record_installment_payment($1, 50000, '2026-10-01')", [priv]), /plan_not_found/);
      // A private plan creates a private expense, invisible to the spouse.
      const ppid = (await one(husband, "select public.record_installment_payment($1, 50000, '2026-10-01', '2026-10-01') as id", [priv])).id;
      const ptx = (await one(husband, "select transaction_id from public.installment_payments where id = $1", [ppid])).transaction_id;
      expect(await q(wife, "select id from public.transactions where id = $1", [ptx])).toHaveLength(0);
    });
  });

  describe("receipt storage", () => {
    it("only allows uploads under a transaction the user can write, and reads via attachment rows", async () => {
      const priv = (
        await one(husband, `insert into public.transactions (household_id, visibility, amount_minor, category_id, occurred_on)
                            values ($1, 'private', 100, $2, '2026-10-01') returning id`, [householdId, sharedCategoryId])
      ).id;
      const path = `${householdId}/${priv}/receipt.jpg`;
      expect((await one(husband, "select public.receipt_path_writable($1) as ok", [path])).ok).toBe(true);
      expect((await one(wife, "select public.receipt_path_writable($1) as ok", [path])).ok).toBe(false);
      expect((await one(wife, "select public.receipt_path_writable($1) as ok", ["../../etc/passwd"])).ok).toBe(false);

      await q(husband, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [path]);
      await expectError(q(wife, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [`${householdId}/${priv}/x.jpg`]), /row-level security/);
      await q(husband, "insert into public.receipt_attachments (transaction_id, storage_path, mime_type, size_bytes) values ($1, $2, 'image/jpeg', 1000)", [priv, path]);
      expect(await q(husband, "select name from storage.objects where name = $1", [path])).toHaveLength(1);
      expect(await q(wife, "select name from storage.objects where name = $1", [path])).toHaveLength(0);
      expect(await q(wife, "select id from public.receipt_attachments where transaction_id = $1", [priv])).toHaveLength(0);
    });
  });
});
