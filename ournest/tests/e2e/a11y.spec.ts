import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);

async function signUpWithHousehold(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("اسمك").fill("هند");
  await page.getByLabel("البريد الإلكتروني").fill(`hind-${run}@test.dev`);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("ournest-pass-4");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.getByRole("button", { name: /إنشاء بيت جديد/ }).click();
  await page.getByRole("button", { name: "إنشاء البيت" }).click();
  await page.getByRole("button", { name: "لاحقًا" }).click();
  await expect(page.getByTestId("hero-remaining")).toBeVisible();
}

for (const scheme of ["light", "dark"] as const) {
  test(`no serious accessibility violations (${scheme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 393, height: 852 } });
    const page = await ctx.newPage();
    await page.goto("/login");
    const loginScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = (r: typeof loginScan) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious(loginScan).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    if (scheme === "light") await signUpWithHousehold(page);
    else {
      await page.goto("/login");
      await page.getByLabel("البريد الإلكتروني").fill(`hind-${run}@test.dev`);
      await page.getByLabel("كلمة المرور", { exact: true }).fill("ournest-pass-4");
      await page.getByRole("button", { name: "تسجيل الدخول" }).click();
      await expect(page.getByTestId("hero-remaining")).toBeVisible();
    }
    for (const path of ["/", "/expenses", "/budget", "/analytics", "/more", "/more/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(900); // let entrance animations settle
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(serious(res).map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
    await ctx.close();
  });
}
