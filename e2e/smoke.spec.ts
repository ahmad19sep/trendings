import { expect, test, type Page } from "@playwright/test";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("dashboard loads real-source mode without fabricated cards", async ({ page }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What is gaining attention now?" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Live preview|No ingestion cycle|Live source unavailable/).first(),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("upcoming page and calendar export are available", async ({ page, request }) => {
  const browserErrors = captureBrowserErrors(page);
  await page.goto("/upcoming");
  await expect(
    page.getByRole("heading", { name: "Upcoming attention windows" }),
  ).toBeVisible();

  const response = await request.get("/upcoming.ics");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("text/calendar");
  expect(await response.text()).toContain("BEGIN:VCALENDAR");
  expect(browserErrors).toEqual([]);
});

test("all secondary routes remain reachable on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile navigation check");
  const browserErrors = captureBrowserErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  const menu = page.locator("#mobile-more-menu");
  await expect(menu.getByRole("link", { name: "Bookmarks" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Digest" })).toBeVisible();
  await menu.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Sources, scoring, and safeguards" }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});
