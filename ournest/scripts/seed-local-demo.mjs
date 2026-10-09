// LOCAL DEVELOPMENT ONLY — populates the local stack with a demo couple so
// every screen can be reviewed with realistic content. It goes through the
// normal API as signed-in users (RLS applies). Never point it at production.
//
// Usage: node --env-file=.local-stack/env scripts/seed-local-demo.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) {
  console.error("Refusing to seed a non-local Supabase URL.");
  process.exit(1);
}

const suffix = process.env.DEMO_SUFFIX ?? "";
const H = { email: `demo.husband${suffix}@ournest.local`, password: "demo-pass-123", name: "محمد" };
const W = { email: `demo.wife${suffix}@ournest.local`, password: "demo-pass-123", name: "نور" };

async function login(u) {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  let { data, error } = await sb.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) {
    ({ data, error } = await sb.auth.signUp({ email: u.email, password: u.password, options: { data: { display_name: u.name } } }));
    if (error) throw error;
  }
  return { sb, id: data.user.id };
}
const must = (r) => {
  if (r.error) throw r.error;
  return r.data;
};

const dubaiToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
const [Y, M, D] = dubaiToday.split("-").map(Number);
const day = (monthOffset, d) => {
  const dt = new Date(Date.UTC(Y, M - 1 + monthOffset, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
};

const h = await login(H);
const w = await login(W);

let household = must(await h.sb.from("household_members").select("household_id").eq("user_id", h.id).maybeSingle())?.household_id;
if (!household) {
  household = must(await h.sb.rpc("create_household", { p_name: "بيتنا" }));
  const token = must(await h.sb.rpc("create_invitation", { p_email: W.email }));
  must(await w.sb.rpc("accept_invitation", { p_token: token }));
  console.log("household created");
} else {
  console.log("household exists — adding more data");
}

const cats = must(await h.sb.from("categories").select("id, system_key"));
const C = Object.fromEntries(cats.map((c) => [c.system_key, c.id]));

const tx = (sb, owner, rows) =>
  sb.from("transactions").insert(rows.map((r) => ({ household_id: household, owner_id: owner, visibility: "shared", ...r })), { defaultToNull: false });

// Three previous months + current month of shared spending.
for (const m of [-3, -2, -1, 0]) {
  const maxDay = m === 0 ? D : 28;
  const rows = [
    { amount_minor: 550000, category_id: C.rent, occurred_on: day(m, 1), description: "إيجار الشقة" },
    { amount_minor: 180000, category_id: C.car_rent, occurred_on: day(m, 3), description: "إيجار السيارة" },
    { amount_minor: 27500, category_id: C.municipality, occurred_on: day(m, 5), description: "رسوم البلدية" },
    { amount_minor: 41250, category_id: C.groceries, occurred_on: day(m, 2), description: "كارفور" },
    { amount_minor: 18900, category_id: C.groceries, occurred_on: day(m, 6), description: "لولو هايبرماركت" },
    { amount_minor: 9500, category_id: C.fuel, occurred_on: day(m, 4), description: "بنزين ENOC" },
    { amount_minor: 5000, category_id: C.fuel, occurred_on: day(m, 7), description: "شحن سالك" },
    { amount_minor: 14500 + 2000 * (m + 3), category_id: C.dining, occurred_on: day(m, 5), description: "عشاء في دبي مول" },
    { amount_minor: 8750, category_id: C.dining, occurred_on: day(m, 8), description: "قهوة" },
    { amount_minor: 45000, category_id: C.telecom, occurred_on: day(m, 8), description: "du إنترنت وموبايل" },
  ].filter((r) => Number(r.occurred_on.slice(8)) <= maxDay);
  must(await tx(m % 2 ? h.sb : w.sb, m % 2 ? h.id : w.id, rows));
  if (m < 0) {
    must(
      await tx(h.sb, h.id, [
        { amount_minor: 22000, category_id: C.groceries, occurred_on: day(m, 15), description: "سبينيس" },
        { amount_minor: 16000, category_id: C.dining, occurred_on: day(m, 18), description: "مطعم لبناني" },
        { amount_minor: 61000, category_id: C.utilities, occurred_on: day(m, 20), description: "ديوا" },
        { amount_minor: 12000, category_id: C.shared_personal, occurred_on: day(m, 22), description: "صيدلية" },
      ]),
    );
  }
}
// Private spending (visible only to its owner).
must(await h.sb.from("transactions").insert([{ household_id: household, owner_id: h.id, visibility: "private", amount_minor: 32000, category_id: C.shared_personal, occurred_on: day(0, 2), description: "اشتراك الجيم" }]));
must(await w.sb.from("transactions").insert([{ household_id: household, owner_id: w.id, visibility: "private", amount_minor: 27500, category_id: C.shared_personal, occurred_on: day(0, 3), description: "هدية لصديقتي" }]));

// Bills
must(
  await h.sb.from("recurring_bills").insert([
    { household_id: household, owner_id: h.id, name: "ديوا", kind: "utilities", category_id: C.utilities, amount_minor: 65000, is_variable: true, anchor_date: day(-2, Math.min(D + 3, 28)) },
    { household_id: household, owner_id: h.id, name: "إيجار الشقة", kind: "rent", category_id: C.rent, amount_minor: 550000, anchor_date: day(-3, 1), autopay: true },
    { household_id: household, owner_id: h.id, name: "تأمين السيارة", kind: "insurance", category_id: C.car_rent, amount_minor: 240000, frequency: "yearly", anchor_date: day(1, 10) },
  ], { defaultToNull: false }),
);

must(await w.sb.from("recurring_bills").insert({ household_id: household, owner_id: w.id, name: "اشتراك نتفليكس", kind: "subscription", category_id: C.telecom, amount_minor: 5600, anchor_date: day(-1, Math.min(D + 6, 28)) }));

// Installment plan with two recorded payments.
const plan = must(
  await h.sb
    .from("installment_plans")
    .insert({ household_id: household, owner_id: h.id, name: "تقسيط الأثاث", lender: "تابي", category_id: C.installments, total_amount_minor: 1200000, monthly_amount_minor: 100000, opening_paid_minor: 300000, first_due_date: day(-5, 12) })
    .select("id")
    .single(),
);
must(await h.sb.rpc("record_installment_payment", { p_plan_id: plan.id, p_amount_minor: 100000, p_paid_on: day(-2, 12), p_period: day(-2, 12) }));
must(await h.sb.rpc("record_installment_payment", { p_plan_id: plan.id, p_amount_minor: 100000, p_paid_on: day(-1, 12), p_period: day(-1, 12) }));

// Goals
const g1 = must(await w.sb.from("savings_goals").insert({ household_id: household, owner_id: w.id, name: "صندوق الطوارئ", kind: "emergency", target_minor: 3000000, monthly_contribution_minor: 100000, target_date: day(10, 1) }).select("id").single());
const g2 = must(await h.sb.from("savings_goals").insert({ household_id: household, owner_id: h.id, name: "السفر لمصر", kind: "travel", target_minor: 1200000, monthly_contribution_minor: 150000, target_date: day(6, 1) }).select("id").single());
must(await w.sb.from("savings_goals").insert({ household_id: household, owner_id: w.id, visibility: "private", name: "مفاجأة عيد الزواج", kind: "other", target_minor: 500000, monthly_contribution_minor: 50000 }));
must(await w.sb.from("savings_contributions").insert([{ goal_id: g1.id, amount_minor: 600000, contributed_on: day(-2, 1) }, { goal_id: g1.id, amount_minor: 100000, contributed_on: day(-1, 1) }], { defaultToNull: false }));
must(await h.sb.from("savings_contributions").insert([{ goal_id: g2.id, amount_minor: 450000, contributed_on: day(-1, 1) }]));

// Private income + public contributions
must(await h.sb.from("income_sources").insert({ owner_id: h.id, household_id: household, name: "الراتب", kind: "salary", amount_minor: 2400000, starts_on: day(-6, 25) }));
must(await w.sb.from("income_sources").insert({ owner_id: w.id, household_id: household, name: "الراتب", kind: "salary", amount_minor: 1800000, starts_on: day(-6, 28) }));
must(await h.sb.from("household_contributions").upsert({ household_id: household, user_id: h.id, effective_month: day(-3, 1), monthly_amount_minor: 850000 }, { onConflict: "household_id,user_id,effective_month" }));
must(await w.sb.from("household_contributions").upsert({ household_id: household, user_id: w.id, effective_month: day(-3, 1), monthly_amount_minor: 550000 }, { onConflict: "household_id,user_id,effective_month" }));

console.log(`✓ demo data ready — log in as ${H.email} / ${H.password} (or ${W.email})`);
