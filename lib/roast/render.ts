import {
  BLOOD_BRIGHT,
  BONE,
  CARD_H,
  CARD_PAD,
  CARD_W,
  finishCard,
  fitText,
  SANS,
  startCard,
} from "@/lib/share/canvas";
import { stripEmphasis } from "@/lib/text/emphasis";

/*
 * The roast card (FEAT-24): one of Chad's own lines, big, on the brand field,
 * with the chadcoach.ai mark. The quote is Chad's REAL output (a chat message,
 * a check-in email, a weekly-report burn) trimmed by the member — the app
 * never writes new Chad copy here (memory preserve-chad-edge). Browser-only;
 * drawing is synchronous (no images), so the same canvas serves the live
 * preview (toDataURL) and the export (toBlob).
 */

const CONTENT_W = CARD_W - CARD_PAD * 2;
const HEADER_BOTTOM = CARD_PAD + 96;
const FOOTER_TOP = CARD_H - CARD_PAD - 60;

/** Straighten whitespace, drop Chad's emphasis markers (the canvas is plain
 * text), and give the quote real curly quotes. */
function asQuote(text: string): string {
  const clean = stripEmphasis(text)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“]|["”]$/g, "");
  return `“${clean}”`;
}

export function renderRoastCardCanvas(text: string): HTMLCanvasElement {
  const { canvas, ctx } = startCard("THE ROAST");

  const quote = fitText(ctx, asQuote(text), {
    weight: 700,
    maxWidth: CONTENT_W,
    maxLines: 11,
    maxSize: 96,
    minSize: 40,
  });
  const lineHeight = quote.size * 1.22;
  const attributionGap = 96;
  const blockH = quote.lines.length * lineHeight + attributionGap;

  // Center the quote in the space between header rule and footer mark.
  const top = Math.max(
    HEADER_BOTTOM + 90,
    HEADER_BOTTOM + (FOOTER_TOP - HEADER_BOTTOM - blockH) / 2
  );

  ctx.fillStyle = BONE;
  ctx.font = `700 ${quote.size}px ${SANS}`;
  for (const [i, line] of quote.lines.entries()) {
    ctx.fillText(line, CARD_PAD, top + quote.size + i * lineHeight);
  }

  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = `700 44px ${SANS}`;
  ctx.fillText(
    "— Chad",
    CARD_PAD,
    top + quote.size + (quote.lines.length - 1) * lineHeight + attributionGap
  );

  finishCard(ctx);
  return canvas;
}
