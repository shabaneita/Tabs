import { expect, test } from "@playwright/test";

test.describe("PWA & iPhone installability", () => {
  test("serves an Arabic RTL standalone manifest with icons", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ lang: "ar", dir: "rtl", display: "standalone", start_url: "/", short_name: "بيتنا" });
    for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });

  test("has Apple web-app meta, touch icon and safe-area viewport", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "بيتنا");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon/);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    expect((await page.request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  });

  test("registers the service worker with the offline page precached", async ({ page }) => {
    await page.goto("/login");
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()), null, { timeout: 15_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // Chromium's offline emulation doesn't cover SW fetches, so verify the fallback asset directly.
    const cached = await page.evaluate(async () => {
      const res = await caches.match("/offline");
      return res ? await res.text() : "";
    });
    expect(cached).toContain("لا يوجد اتصال بالإنترنت");
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "لا يوجد اتصال بالإنترنت" })).toBeVisible();
  });

  test("service worker never caches API traffic", async ({ request }) => {
    const sw = await (await request.get("/sw.js")).text();
    expect(sw).toContain("url.origin !== self.location.origin");
    expect(sw).not.toMatch(/addEventListener\("sync"|indexedDB/);
  });

  test("respects the system dark theme before hydration (no flash)", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.route("**/_next/static/**/*.js", (r) => r.abort()); // no React at all
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await ctx.close();
  });
});
