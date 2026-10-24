import { expect, test, type Page } from "@playwright/test";

/**
 * The definition-of-success workflow, end to end against a real Supabase
 * project seeded with `npm run seed`:
 *
 *   create enquiry → review 2BHK matches → generate microsite → WhatsApp link →
 *   mark contacted → buyer opens microsite, floor plan, payment plan, brochure →
 *   buyer requests a viewing → agent sees engagement and confirms the viewing.
 *
 * Set E2E_EMAIL and E2E_PASSWORD (the seeded admin). Skipped otherwise.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run the agent workflow against Supabase");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function pick(page: Page, label: string, option: string) {
  // Required fields render "Label *", so match the start of the label.
  await page.getByLabel(new RegExp(`^${label}`)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("agent turns an enquiry into a tracked microsite and a viewing", async ({ page, browser }) => {
  const buyer = `Ahmed E2E ${Date.now().toString().slice(-5)}`;
  await signIn(page);

  // 1. New enquiry
  await page.getByRole("link", { name: "New Enquiry" }).first().click();
  await page.getByLabel("Buyer name").fill(buyer);
  await page.getByLabel("Mobile / WhatsApp number").fill("+91 98123 45678");
  await pick(page, "Development", "Example Residences");
  await pick(page, "Preferred configuration", "2BHK");
  await page.getByLabel("Budget minimum").fill("80L");
  await page.getByLabel("Budget maximum").fill("1Cr");
  await page.getByRole("button", { name: "Save and match properties" }).click();

  // 2. Matching: only available 2BHKs within budget are exact matches.
  await expect(page.getByRole("heading", { name: "Review matching properties" })).toBeVisible();
  await expect(page.getByText(/Exact matches \(\d+\)/)).toBeVisible();
  await expect(page.getByText("A-0603")).toHaveCount(0); // reserved sample unit
  await expect(page.getByText("A-0302")).toHaveCount(0); // sold sample unit

  // 3. Generate
  await page.getByRole("button", { name: "Generate Personalised Microsite" }).click();
  await expect(page).toHaveURL(/\/dashboard\/enquiries\/[0-9a-f-]+\?shared=new/);
  const link = (await page.locator("code").filter({ hasText: "/p/" }).first().textContent())!.trim();
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{43}$/);

  // 4. WhatsApp click-to-chat link: digits only, encoded personalised message.
  const wa = page.getByRole("link", { name: "Send via WhatsApp" });
  const href = (await wa.getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/919812345678?text=")).toBe(true);
  const text = new URL(href).searchParams.get("text")!;
  expect(text).toContain(`Hi ${buyer.split(" ")[0]}`);
  expect(text).toContain(link);
  await expect(page.getByText(/Nothing is sent until you press Send/)).toBeVisible();

  // 5. Mark contacted only after an explicit confirmation.
  await page.getByRole("button", { name: /Mark as Contacted/ }).click();
  await expect(page.getByText("Contacted").first()).toBeVisible();

  // 6. Buyer opens the link on a phone, in a separate browser context.
  const buyerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const buyerPage = await buyerContext.newPage();
  await buyerPage.goto(link);
  await expect(buyerPage.getByRole("heading", { name: /explore the 2BHK homes selected for you/ })).toBeVisible();
  await buyerPage.getByRole("button", { name: "Floor plan" }).first().click();
  await buyerPage.keyboard.press("Escape");
  await buyerPage.getByText("See how payments are staged").click();
  await buyerPage.getByRole("link", { name: /Read brochure/ }).click();
  // pdf.js is a large bundle; a cold dev server compiles it on first use.
  await expect(buyerPage.getByText(/1 \/ \d+/)).toBeVisible({ timeout: 30_000 });
  await buyerPage.waitForTimeout(1500);
  await buyerPage.getByRole("link", { name: /Back/ }).first().click();

  // 7. Buyer requests a viewing.
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await buyerPage.getByLabel("Mobile / WhatsApp number").fill("+91 98123 45678");
  await buyerPage.getByLabel("Preferred date").fill(date);
  await buyerPage.getByText("Morning", { exact: true }).click();
  await buyerPage.getByRole("button", { name: "Request a viewing", exact: true }).click();
  await expect(buyerPage.getByText("Your viewing request has been received. The property team will contact you to confirm the details.")).toBeVisible();
  await buyerContext.close();

  // 8. Agent sees recorded engagement and the request.
  await page.reload();
  await expect(page.getByText("Microsite opened").first()).toBeVisible();
  await expect(page.getByText(/Floor plan opened/).first()).toBeVisible();
  await expect(page.getByText("Payment plan opened").first()).toBeVisible();
  await expect(page.getByText(/Brochure page 1 displayed/).first()).toBeVisible();
  await expect(page.getByText(/Viewing request submitted/).first()).toBeVisible();

  // 9. Agent confirms the viewing; the enquiry moves to Viewing scheduled.
  await page.getByRole("button", { name: "Manage" }).first().click();
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Confirmed" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Viewing scheduled").first()).toBeVisible();
});

test("an agent cannot open a record that does not belong to their organisation", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/enquiries/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Record not found" })).toBeVisible();
});
