import {
  BLOOD_BRIGHT,
  BONE,
  CARD_PAD,
  CARD_W,
  canvasToPngBlob,
  drawLines,
  finishCard,
  fitText,
  LINE,
  MUTED,
  PANEL,
  SANS,
  startCard,
  wrapLines,
} from "@/lib/share/canvas";

/*
 * The Quit Date share cards (FEAT-23) — the receipts. Browser-only, lazily
 * imported from the share buttons on /quit-date. Two cards:
 *
 * - THE VERDICT: the day-0 card — the predicted date + failure mode + Chad's
 *   challenge. The card people post the day they sign up.
 * - THE RECEIPT: the unfakeable testimonial — "Chad gave me 23 days. I'm on
 *   day 61." A dated prediction next to the streak that outlived it.
 *
 * All wording is reused from the shipped feature / the owner-approved FEAT-21
 * spec ("Prove me wrong.", "Still here.") — no new Chad register is invented
 * (memory preserve-chad-edge).
 */

export type VerdictCardData = {
  dateLabel: string;
  dayCount: number;
  failureMode: string;
};

export type ReceiptCardData = {
  givenDays: number;
  currentDay: number;
  dateLabel: string;
};

const CONTENT_W = CARD_W - CARD_PAD * 2;

function eyebrow(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number
): void {
  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = `800 34px ${SANS}`;
  // Manual letterspacing (canvas has no tracking): thin-space the characters.
  ctx.fillText(text.split("").join(" "), CARD_PAD, y);
}

/** Render THE VERDICT card and return it as a PNG blob. */
export async function renderVerdictCard(
  data: VerdictCardData
): Promise<Blob> {
  const { canvas, ctx } = startCard("THE QUIT DATE");

  eyebrow(ctx, "THE VERDICT", 330);

  // The predicted date, as big as it fits.
  const date = fitText(ctx, data.dateLabel, {
    weight: 800,
    maxWidth: CONTENT_W,
    maxLines: 2,
    maxSize: 128,
    minSize: 72,
  });
  ctx.fillStyle = BONE;
  const afterDate = drawLines(
    ctx,
    date.lines,
    CARD_PAD,
    330 + 40 + date.size,
    date.size * 1.08
  );

  ctx.fillStyle = MUTED;
  ctx.font = `500 40px ${SANS}`;
  ctx.fillText(
    `Chad says I quit on Day ${data.dayCount} of my membership.`,
    CARD_PAD,
    afterDate + 18
  );

  // Failure-mode panel.
  const panelY = afterDate + 88;
  ctx.font = `500 38px ${SANS}`;
  const modeLines = wrapLines(ctx, `${data.failureMode}.`, CONTENT_W - 96);
  const panelH = 120 + modeLines.length * 52;
  ctx.fillStyle = PANEL;
  ctx.fillRect(CARD_PAD, panelY, CONTENT_W, panelH);
  ctx.strokeStyle = "rgba(164, 22, 26, 0.55)";
  ctx.strokeRect(CARD_PAD + 0.5, panelY + 0.5, CONTENT_W - 1, panelH - 1);
  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = `800 30px ${SANS}`;
  ctx.fillText("HOW IT HAPPENS", CARD_PAD + 48, panelY + 68);
  ctx.fillStyle = BONE;
  ctx.font = `500 38px ${SANS}`;
  drawLines(ctx, modeLines, CARD_PAD + 48, panelY + 132, 52);

  // Chad's challenge — the owner-approved spec line, verbatim.
  ctx.fillStyle = BONE;
  const challenge = fitText(ctx, "“I’ve seen your type. Prove me wrong.”", {
    weight: 700,
    maxWidth: CONTENT_W,
    maxLines: 3,
    maxSize: 64,
    minSize: 44,
  });
  const challengeY = panelY + panelH + 96 + challenge.size;
  const afterChallenge = drawLines(
    ctx,
    challenge.lines,
    CARD_PAD,
    challengeY - challenge.size,
    challenge.size * 1.18
  );
  ctx.fillStyle = MUTED;
  ctx.font = `600 36px ${SANS}`;
  ctx.fillText("— Chad", CARD_PAD, afterChallenge + 16);

  finishCard(ctx);
  return canvasToPngBlob(canvas);
}

/** Render THE RECEIPT card and return it as a PNG blob. */
export async function renderReceiptCard(
  data: ReceiptCardData
): Promise<Blob> {
  const { canvas, ctx } = startCard("THE QUIT DATE");

  eyebrow(ctx, "THE RECEIPT", 360);

  ctx.fillStyle = MUTED;
  ctx.font = `600 58px ${SANS}`;
  ctx.fillText(`Chad gave me ${data.givenDays} days.`, CARD_PAD, 360 + 118);

  // The number that outlived the prediction, as loud as the canvas allows.
  ctx.fillStyle = BLOOD_BRIGHT;
  const big = fitText(ctx, `I’m on day ${data.currentDay}.`, {
    weight: 800,
    maxWidth: CONTENT_W,
    maxLines: 2,
    maxSize: 150,
    minSize: 84,
  });
  const afterBig = drawLines(
    ctx,
    big.lines,
    CARD_PAD,
    360 + 158 + big.size,
    big.size * 1.08
  );

  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD, afterBig + 40);
  ctx.lineTo(CARD_W - CARD_PAD, afterBig + 40);
  ctx.stroke();

  ctx.fillStyle = BONE;
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText(`He called ${data.dateLabel}.`, CARD_PAD, afterBig + 130);
  ctx.fillText("Still here.", CARD_PAD, afterBig + 196);

  finishCard(ctx);
  return canvasToPngBlob(canvas);
}
