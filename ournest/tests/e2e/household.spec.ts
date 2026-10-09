import { devices, expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Full two-spouse journey against the real local stack:
 * sign-up → household → invitation → shared & private expenses →
 * privacy boundary in the UI → budget maths → notifications.
 */
const run = Date.now().toString(36);
const husband = { name: "أحمد", email: `ahmed-${run}@test.dev`, password: "ournest-pass-1" };
const wife = { name: "سارة", email: `sara-${run}@test.dev`, password: "ournest-pass-2" };
const SHOTS = process.env.E2E_SCREENSHOTS;

async function signUp(page: Page, who: typeof husband) {
  await page.getByLabel("اسمك").fill(who.name);
  await page.getByLabel("البريد الإلكتروني").fill(who.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
}

async function addExpense(page: Page, digits: string, category: string, opts: { private?: boolean; note?: string } = {}) {
  await page.getByTestId("fab-add").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "أضف مصروف" })).toBeVisible();
  if (opts.private) await sheet.getByRole("radio", { name: "خاص بي" }).click();
  for (const d of digits) await sheet.getByRole("button", { name: d === "." ? "فاصلة عشرية" : d, exact: true }).click();
  await sheet.getByRole("radio", { name: category }).click();
  if (opts.note) {
    await sheet.getByRole("button", { name: "ملاحظة" }).click();
    await sheet.getByLabel("الوصف").fill(opts.note);
  }
  await sheet.getByTestId("save-expense").click();
  await expect(page.getByText(opts.private ? "تم حفظ المصروف" : "تم حفظ المصروف").first()).toBeVisible();
  await expect(sheet).toBeHidden();
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

let inviteLink = "";
let husbandPage: Page;
let wifePage: Page;

test.describe.serial("two-spouse household", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const ctxOpts = { locale: "ar-AE", timezoneId: "Asia/Dubai" } as const;
    husbandPage = await (await browser.newContext({ ...devices["iPhone 15"], ...ctxOpts, colorScheme: "light" })).newPage();
    wifePage = await (await browser.newContext({ ...devices["iPhone 15"], ...ctxOpts, colorScheme: "dark" })).newPage();
  });

  test("RTL Arabic login page", async () => {
    await husbandPage.goto("/");
    await expect(husbandPage).toHaveURL(/\/login/);
    const html = husbandPage.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(husbandPage.getByRole("heading", { name: "أهلًا بعودتك" })).toBeVisible();
    await shot(husbandPage, "01-login");
  });

  test("husband signs up and creates the household with the 14,000 AED template", async () => {
    await husbandPage.goto("/signup");
    await signUp(husbandPage, husband);
    await expect(husbandPage).toHaveURL(/\/onboarding/);
    await husbandPage.getByRole("button", { name: /إنشاء بيت جديد/ }).click();
    await husbandPage.getByRole("button", { name: "إنشاء البيت" }).click();
    await expect(husbandPage.getByRole("heading", { name: "ادعُ شريك حياتك" })).toBeVisible();
    await husbandPage.getByLabel("بريد شريكك الإلكتروني").fill(wife.email);
    await husbandPage.getByRole("button", { name: "إنشاء رابط الدعوة" }).click();
    const linkEl = husbandPage.locator("p[dir=ltr]").filter({ hasText: "/invite/" });
    await expect(linkEl).toBeVisible();
    inviteLink = (await linkEl.textContent())!.trim();
    expect(inviteLink).toMatch(/\/invite\/[0-9a-f]{48}$/);
    await shot(husbandPage, "02-invite");
    await husbandPage.getByRole("button", { name: "الذهاب للرئيسية" }).click();
    await expect(husbandPage.getByTestId("hero-remaining")).toContainText("14,000");
    await shot(husbandPage, "03-dashboard-empty-light");
  });

  test("wife accepts the invitation", async () => {
    await wifePage.goto(new URL(inviteLink).pathname);
    await expect(wifePage.getByRole("heading", { name: /يدعوك إلى/ })).toBeVisible();
    await wifePage.getByRole("link", { name: "إنشاء حساب والانضمام" }).click();
    await signUp(wifePage, wife);
    await expect(wifePage).toHaveURL(/\/invite\//);
    await wifePage.getByRole("button", { name: "قبول الدعوة" }).click();
    await expect(wifePage.getByTestId("hero-remaining")).toBeVisible();
  });

  test("wife records shared and private expenses in a few taps", async () => {
    const started = Date.now();
    await addExpense(wifePage, "125", "أكل وسوبر ماركت", { note: "كارفور" });
    expect(Date.now() - started).toBeLessThan(10_000);
    await addExpense(wifePage, "99", "مطاعم وخروجات", { private: true, note: "هدية سرية" });
    await expect(wifePage.getByTestId("hero-remaining")).toContainText("13,875");
    await shot(wifePage, "04-dashboard-dark");
  });

  test("husband sees the shared expense but never the private one", async () => {
    await husbandPage.goto("/expenses");
    await expect(husbandPage.getByText("كارفور")).toBeVisible();
    await expect(husbandPage.getByText("هدية سرية")).toHaveCount(0);
    await expect(husbandPage.getByTestId("expenses-total")).toContainText("125");
    await husbandPage.getByRole("radio", { name: "مصاريفي الخاصة" }).click();
    await expect(husbandPage.getByText("لا توجد مصاريف في هذه الفترة")).toBeVisible();
    await shot(husbandPage, "05-expenses");
  });

  test("household budget counts only shared spending", async () => {
    await husbandPage.goto("/budget");
    await expect(husbandPage.getByTestId("budget-total")).toContainText("14,000");
    await expect(husbandPage.getByTestId("budget-unallocated")).toContainText("825");
    await expect(husbandPage.getByText("المصروف الفعلي").first()).toBeVisible();
    await shot(husbandPage, "06-budget");
    await husbandPage.goto("/");
    await expect(husbandPage.getByTestId("hero-remaining")).toContainText("13,875");
  });

  test("husband is notified about the shared expense only", async () => {
    await husbandPage.goto("/notifications");
    await expect(husbandPage.getByText("مصروف مشترك جديد")).toBeVisible();
    await expect(husbandPage.getByText("هدية سرية")).toHaveCount(0);
    await husbandPage.goto("/more/activity");
    await expect(husbandPage.getByTestId("activity-item").first()).toContainText("كارفور");
    await expect(husbandPage.getByText("هدية سرية")).toHaveCount(0);
  });

  test("analytics, report and theme toggle", async () => {
    await husbandPage.goto("/analytics");
    await expect(husbandPage.getByRole("heading", { name: "المصروف حسب التصنيف" })).toBeVisible();
    await shot(husbandPage, "07-analytics");
    await husbandPage.goto(`/report?month=${new Date().toISOString().slice(0, 7)}&scope=household`);
    await expect(husbandPage.getByTestId("report")).toContainText("كارفور");
    await expect(husbandPage.getByTestId("report")).not.toContainText("هدية سرية");
    await husbandPage.goto("/");
    await husbandPage.getByRole("button", { name: "التبديل إلى الوضع الداكن" }).click();
    await expect(husbandPage.locator("html")).toHaveClass(/dark/);
    // Persisted per user: survives a reload.
    await husbandPage.reload();
    await expect(husbandPage.locator("html")).toHaveClass(/dark/);
    await shot(husbandPage, "08-dashboard-dark-husband");
  });

  test("no horizontal overflow on key screens", async () => {
    for (const path of ["/", "/expenses", "/budget", "/analytics", "/more", "/more/bills", "/more/goals", "/more/installments", "/more/settings"]) {
      await husbandPage.goto(path);
      await husbandPage.waitForLoadState("networkidle");
      const overflow = await husbandPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
