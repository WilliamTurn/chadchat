/*
 * Shared canvas plumbing for the branded share cards (FEAT-23 quit-date
 * cards, FEAT-24 roast cards). Browser-only, lazily imported from click
 * handlers — the same pattern as lib/montage/render.ts, whose palette and
 * word-wrap this generalizes. Cards are 1080×1350 (the portrait size every
 * major social feed renders full-bleed), drawn on a dark brand field with the
 * CHAD wordmark up top and the chadcoach.ai mark at the bottom, so every
 * share is an ad.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_PAD = 88;

export const INK = "#0b0b0d";
export const PANEL = "#141417";
export const BONE = "#e7e4df";
export const MUTED = "rgba(231, 228, 223, 0.62)";
export const FAINT = "rgba(231, 228, 223, 0.4)";
export const BLOOD = "#a4161a";
export const BLOOD_BRIGHT = "#ff453a";
export const LINE = "rgba(231, 228, 223, 0.14)";

export const SANS = "system-ui, sans-serif";

/** Word-wrap `text` at the current ctx.font, returning the wrapped lines. */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

/** Draw pre-wrapped lines top-down; returns the y just below the last line. */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number
): number {
  for (const [i, line] of lines.entries()) {
    ctx.fillText(line, x, y + i * lineHeight);
  }
  return y + lines.length * lineHeight;
}

/**
 * Pick the largest font size (between min and max) at which `text` wraps to
 * at most `maxLines` at `maxWidth`. Sets ctx.font and returns the size + the
 * wrapped lines, so a short quote renders huge and a long one still fits.
 */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    weight: number;
    maxWidth: number;
    maxLines: number;
    maxSize: number;
    minSize: number;
  }
): { size: number; lines: string[] } {
  let size = opts.maxSize;
  while (size > opts.minSize) {
    ctx.font = `${opts.weight} ${size}px ${SANS}`;
    const lines = wrapLines(ctx, text, opts.maxWidth);
    if (lines.length <= opts.maxLines) {
      return { size, lines };
    }
    size -= 4;
  }
  ctx.font = `${opts.weight} ${size}px ${SANS}`;
  return { size, lines: wrapLines(ctx, text, opts.maxWidth).slice(0, opts.maxLines) };
}

/** A fresh dark card canvas with the CHAD wordmark + a section label up top. */
export function startCard(label: string): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unsupported");
  }

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Wordmark row
  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = `800 64px ${SANS}`;
  ctx.fillText("CHAD", CARD_PAD, CARD_PAD + 52);
  const chadW = ctx.measureText("CHAD").width;
  ctx.fillStyle = MUTED;
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText(label, CARD_PAD + chadW + 28, CARD_PAD + 48);

  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD, CARD_PAD + 96);
  ctx.lineTo(CARD_W - CARD_PAD, CARD_PAD + 96);
  ctx.stroke();

  return { canvas, ctx };
}

/** The chadcoach.ai mark, bottom-right — every shared card carries it. */
export function finishCard(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = FAINT;
  ctx.font = `600 32px ${SANS}`;
  const site = "chadcoach.ai";
  ctx.fillText(
    site,
    CARD_W - CARD_PAD - ctx.measureText(site).width,
    CARD_H - CARD_PAD + 16
  );
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png"
    )
  );
}

/**
 * Share the card through the native share sheet on touch devices (where the
 * sheet is the way people post); on desktop just download it — desktop
 * Chrome technically supports navigator.share but opens a clunky OS dialog.
 * Returns which one happened so the caller can word its toast. A user
 * cancelling the share sheet resolves as "cancelled" — not an error, no
 * fallback download.
 */
export async function shareOrDownloadPng(
  blob: Blob,
  filename: string
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  // "Primary pointer is coarse" = a phone/tablet, where the sheet is native;
  // a touchscreen laptop still counts as desktop (its primary pointer is the
  // trackpad/mouse), so maxTouchPoints alone would misroute it.
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (
    isTouchDevice &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // Share sheet unavailable after all — fall through to download.
    }
  }
  downloadPng(blob, filename);
  return "downloaded";
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
