import { expect, test } from "@playwright/test";

test.describe("Authentication Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("No account?")).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Confirm password", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(page.getByText("Have an account?")).toBeVisible();
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("can navigate from register to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  // One account per email: the DB now enforces User_email_unique (the old
  // check-then-insert allowed twin accounts under concurrent signups). This
  // drives the sequential path; the race path is covered by the constraint.
  test("registering an already-registered email shows the inline error", async ({
    page,
    context,
  }) => {
    const email = `dupe-${Date.now()}@playwright.com`;
    const password = "Aa1-dupetest";
    const signUp = async () => {
      await page.goto("/register");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Sign up" }).click();
    };

    await signUp();
    await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
      timeout: 30_000,
    });

    await context.clearCookies();
    await signUp();
    await expect(
      page.getByText("An account with this email already exists")
    ).toBeVisible({ timeout: 15_000 });
  });
});
