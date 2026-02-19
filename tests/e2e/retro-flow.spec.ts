import { expect, test } from "@playwright/test";

test("facilitator can run session through discussion and happiness", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Team Name").fill("Platform Team");
  await page.getByLabel("Facilitator Name").fill("Jordan");
  await page.getByRole("button", { name: "Launch Retrospective" }).click();

  await expect(page.getByRole("heading", { name: "Platform Team Retrospective" })).toBeVisible();

  const commentInputs = page.getByPlaceholder("Type your comment. Enter to add, Shift+Enter for newline.");
  await commentInputs.first().fill("Shipped key features");
  await commentInputs.first().press("Enter");

  const startButton = page.getByRole("button", { name: /Start Discussion/ });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  await expect(page.getByText("1/1")).toBeVisible();
  await page.getByRole("button", { name: "Action Items" }).click();

  await expect(page.getByRole("heading", { name: "Action Items" })).toBeVisible();
  await page.getByPlaceholder("Add an action item. Enter to add, Shift+Enter for newline.").fill("Improve CI reliability");
  await page.getByPlaceholder("Add an action item. Enter to add, Shift+Enter for newline.").press("Enter");
  await expect(page.getByText("Improve CI reliability")).toBeVisible();

  await page.getByRole("button", { name: "Happiness Check" }).click();
  await expect(page.getByRole("heading", { name: "Happiness Check" })).toBeVisible();
  await page.getByRole("button", { name: "Submit Check" }).click();
  await expect(page.getByRole("heading", { name: "Retrospective Summary" })).toBeVisible();
});

test("participant can join via invite link", async ({ browser, page }) => {
  let createdSlug = "";
  page.on("response", async (response) => {
    if (!response.url().endsWith("/api/sessions")) return;
    if (response.request().method() !== "POST") return;
    try {
      const data = await response.json();
      createdSlug = data?.session?.slug ?? createdSlug;
    } catch {
      // ignore parse failures
    }
  });

  await page.goto("/");

  await page.getByLabel("Team Name").fill("Core Services");
  await page.getByLabel("Facilitator Name").fill("Taylor");
  await page.getByRole("button", { name: "Launch Retrospective" }).click();

  await expect(page.getByRole("heading", { name: "Core Services Retrospective" })).toBeVisible();
  await expect.poll(() => createdSlug).not.toEqual("");

  const context = await browser.newContext();
  const participantPage = await context.newPage();
  await participantPage.goto(`/session/${createdSlug}/join`);
  await participantPage.getByPlaceholder("Your name").fill("Priya");
  await participantPage.getByRole("button", { name: "Join Session" }).click();

  await expect(participantPage.getByRole("heading", { name: "Core Services Retrospective" })).toBeVisible();
  await expect(participantPage.getByRole("button", { name: /Start Discussion/ })).toBeDisabled();

  await context.close();
});
