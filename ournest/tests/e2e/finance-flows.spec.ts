import { expect, test, type Page } from "@playwright/test";

/** Bills, installments and goals with one fresh solo household. */
const run = Date.now().toString(36);
const user = { name: "ليلى", email: `layla-${run}@test.dev`, password: "ournest-pass-3" };

async function setup(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("اسمك").fill(user.name);
  await page.getByLabel("البريد الإلكتروني").fill(user.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.getByRole("button", { name: /إنشاء بيت جديد/ }).click();
  await page.getByRole("button", { name: "إنشاء البيت" }).click();
  await page.getByRole("button", { name: "لاحقًا" }).click();
  await expect(page.getByTestId("hero-remaining")).toBeVisible();
}

test.describe.serial("finance flows", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await setup(page);
  });

  test("a bill paid once is never counted twice", async () => {
    await page.goto("/more/bills");
    await page.getByRole("button", { name: "إضافة فاتورة" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: "كهرباء ومياه (ديوا)" }).click();
    await sheet.getByLabel("المبلغ", { exact: true }).fill("650");
    await sheet.getByRole("switch", { name: "المبلغ متغير" }).click();
    await expect(sheet.getByLabel("المبلغ التقريبي")).toHaveValue("650");
    await sheet.getByRole("button", { name: "حفظ" }).click();
    await expect(page.getByText("تمت إضافة الفاتورة")).toBeVisible();

    // Today's occurrence is due → pay it with an edited (variable) amount.
    await page.getByRole("button", { name: "تسجيل الدفع" }).first().click();
    const pay = page.getByRole("dialog");
    await expect(pay.getByRole("heading", { name: /دفع/ })).toBeVisible();
    await pay.getByTestId("amount-display").click(); // clear
    for (const d of "612") await pay.getByRole("button", { name: d, exact: true }).click();
    await pay.getByTestId("save-expense").click();
    await expect(page.getByText("تم حفظ المصروف").first()).toBeVisible();
    await expect(page.getByText("مدفوعة").first()).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("hero-remaining")).toContainText("13,388");
  });

  test("installment payment reduces the balance and is budgeted once", async () => {
    await page.goto("/more/installments");
    await page.getByRole("button", { name: "إضافة قسط" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("الاسم").fill("تقسيط الثلاجة");
    await sheet.getByLabel("المبلغ الإجمالي المستحق").fill("3000");
    await sheet.getByLabel("القسط الشهري").fill("500");
    await sheet.getByRole("button", { name: "حفظ" }).click();
    await expect(page.getByText("تمت إضافة القسط")).toBeVisible();
    await page.getByText("تقسيط الثلاجة").click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: "تسجيل الدفعة" }).click();
    await expect(page.getByText("تم تسجيل الدفعة وإضافتها للمصاريف")).toBeVisible();
    await expect(page.getByText("5 أقساط")).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("hero-remaining")).toContainText("12,888");
  });

  test("early payoff simulation shows months saved", async () => {
    await page.goto("/more/installments");
    await page.getByText("تقسيط الثلاجة").click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("radio", { name: "سداد مبكر" }).click();
    await detail.getByLabel("مبلغ إضافي شهريًا").fill("500");
    await expect(detail.getByText(/توفّر/)).toContainText("شهرين");
  });

  test("savings goal progress from contributions", async () => {
    await page.goto("/more/goals");
    await page.getByRole("button", { name: "صندوق الطوارئ" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("المبلغ المستهدف").fill("10000");
    await sheet.getByLabel("المساهمة الشهرية المخططة").fill("1000");
    await sheet.getByRole("button", { name: "حفظ" }).click();
    await expect(page.getByText("تم إنشاء الهدف")).toBeVisible();
    await page.getByTestId("goal-card").click();
    const detail = page.getByRole("dialog");
    await detail.getByLabel("المبلغ").fill("2500");
    await detail.getByRole("button", { name: "إضافة للهدف" }).click();
    await expect(page.getByText("تمت إضافة المبلغ للهدف")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("goal-card")).toContainText("25٪");
  });

  test("CSV export downloads Arabic UTF-8 with BOM", async () => {
    await page.goto("/more/export");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "تنزيل CSV" }).click()]);
    const path = await download.path();
    const fs = await import("node:fs");
    const text = fs.readFileSync(path!, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("التاريخ,المبلغ (د.إ),التصنيف");
    expect(text).toContain("612");
  });

  test("monthly report renders as a PDF with Arabic text", async () => {
    await page.goto(`/report?month=${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date()).slice(0, 7)}&scope=household`);
    await expect(page.getByTestId("report")).toContainText("الميزانية مقابل الفعلي");
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
