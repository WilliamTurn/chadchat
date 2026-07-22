/**
 * FEAT-20 dictation stop-affordance contract (owner report 2026-07-22: nothing
 * told members a second mic tap ends the take). While recording, the composer
 * must show the standard mainstream dictation state — an explicit red stop
 * button, a live timer, and a cancel control — with the send button yielding
 * its slot. Stop transcribes into the input; cancel throws the take away.
 *
 * Chromium's fake media device supplies the audio; /api/transcribe is mocked
 * so the gate never spends gateway money on silence.
 */

import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";

const PHONE = { width: 390, height: 844 };

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }, workerInfo) => {
  const email = `voice-${Date.now()}-w${workerInfo.workerIndex}@playwright.com`;
  const strongPassword = `Aa1-${Math.random().toString(36).slice(2, 12)}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(strongPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(strongPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();
  // Generous: registration on this dev box takes ~40s when routes are cold.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 120_000,
  });

  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  try {
    const updated = await sql`
      UPDATE "User"
      SET "subscriptionStatus" = 'active',
          "subscriptionTier"   = 'pro',
          "currentPeriodEnd"   = now() + interval '30 days',
          "onboardedAt"        = now()
      WHERE email = ${email}
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error(`voice-input setup: provisioning failed for ${email}`);
    }
  } finally {
    await sql.end();
  }

  storageState = await context.storageState();
  await context.close();
});

test("recording shows stop + timer + cancel; stop lands words in the input; cancel discards", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState,
    permissions: ["microphone"],
    viewport: PHONE,
  });
  let transcribeCalls = 0;
  await context.route("**/api/transcribe", async (route) => {
    transcribeCalls += 1;
    await route.fulfill({ json: { text: "Bench felt heavy today" } });
  });

  const page = await context.newPage();
  await page.goto("/");

  const mic = page.getByTestId("voice-input-button");
  await expect(mic).toBeVisible();
  await expect(mic).toHaveAccessibleName("Dictate a message");

  // Tap the mic: the composer must flip to the explicit recording state.
  await mic.click();
  const stopButton = page.getByTestId("voice-stop-button");
  await expect(stopButton).toBeVisible();
  await expect(stopButton).toHaveAccessibleName("Stop recording");
  const cancelButton = page.getByTestId("voice-cancel-button");
  await expect(cancelButton).toBeVisible();
  await expect(cancelButton).toHaveAccessibleName("Cancel recording");
  await expect(page.getByTestId("voice-recording-timer")).toBeVisible();
  await expect(page.getByTestId("multimodal-input")).toHaveAttribute(
    "placeholder",
    "Listening..."
  );
  // The stop control takes the send slot while the mic is hot.
  await expect(page.getByTestId("send-button")).toHaveCount(0);

  // Outlast the click-through discard threshold, then stop: the (mocked)
  // transcript must land in the input for review, never auto-send.
  await page.waitForTimeout(600);
  await stopButton.click();
  const input = page.getByTestId("multimodal-input");
  await expect(input).toHaveValue("Bench felt heavy today");
  await expect(mic).toBeVisible();
  await expect(page.getByTestId("send-button")).toBeVisible();
  expect(transcribeCalls).toBe(1);

  // Round two: cancel must discard the take — no transcription request, no
  // words appended, composer back to idle.
  await mic.click();
  await expect(stopButton).toBeVisible();
  await page.waitForTimeout(600);
  await cancelButton.click();
  await expect(mic).toBeVisible();
  await expect(input).toHaveValue("Bench felt heavy today");
  expect(transcribeCalls).toBe(1);

  await context.close();
});
