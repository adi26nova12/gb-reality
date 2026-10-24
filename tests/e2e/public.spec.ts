import { expect, test } from "@playwright/test";

/**
 * Checks that need no credentials: access control on the dashboard, safe
 * handling of bad microsite links and validation on public endpoints.
 */

test("signed-out visitors cannot reach the dashboard", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/enquiries", "/dashboard/enquiries/new", "/dashboard/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(login|setup)(\?|$)/);
    await expect(page.getByRole("heading", { name: /sign in|connect the platform/i })).toBeVisible();
  }
});

test("an unknown microsite link shows a polished unavailable page, not data", async ({ page }) => {
  const res = await page.goto("/p/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  expect(res?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/couldn't find|temporarily unavailable/i);
  await expect(page.getByText(/request a viewing/i)).toHaveCount(0);
});

test("malformed tokens are rejected before any lookup", async ({ page }) => {
  await page.goto("/p/..%2F..%2Fetc");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/couldn't find|temporarily unavailable/i);
});

test("public tracking endpoint validates its input", async ({ request }) => {
  const bad = await request.post("/api/public/microsites/short/events", { data: { eventType: "microsite_opened" } });
  expect(bad.status()).toBe(404);

  const token = "B".repeat(43);
  const invalid = await request.post(`/api/public/microsites/${token}/events`, { data: { eventType: "marked_contacted", sessionId: "nope" } });
  expect([400, 503]).toContain(invalid.status());
});

test("viewing request endpoint rejects incomplete submissions", async ({ request }) => {
  const token = "C".repeat(43);
  const res = await request.post(`/api/public/microsites/${token}/viewing-requests`, { data: { name: "" } });
  expect([400, 503]).toContain(res.status());
});

test("buyer microsite layout (development preview with sample data)", async ({ page }) => {
  const res = await page.goto("/dev/microsite");
  test.skip(res?.status() === 404, "Design preview routes are disabled in production builds");
  await expect(page.getByRole("heading", { name: "Ahmed, explore the 2BHK homes selected for you." })).toBeVisible();
  await expect(page.getByText("Agent preview")).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Floor plan" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("available on request");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Request a viewing", exact: true }).click();
  await expect(page.getByText("Please enter your mobile number.")).toBeVisible();
});

test("account pages and the team page are not reachable signed out", async ({ page }) => {
  for (const path of ["/dashboard/settings/team", "/account/set-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(login|setup)(\?|$)/);
  }
});

test("an invalid email link never signs anyone in", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=forged&type=invite&next=https://evil.example");
  await expect(page).toHaveURL(/\/(login\?error=link|setup)/);
});

test("the notification email webhook rejects unauthenticated calls", async ({ request }) => {
  const res = await request.post("/api/internal/notifications/email", {
    data: { type: "INSERT", table: "notifications", record: { id: "00000000-0000-4000-8000-000000000000" } },
    headers: { Authorization: "Bearer wrong" },
  });
  expect([401, 503]).toContain(res.status());
});
