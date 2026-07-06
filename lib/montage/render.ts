import type { ProgressMontageContent } from "./content";

/*
 * Client-side montage PNG exporter (FEAT-18). Mirrors the lib/pdf/* pattern:
 * a browser-only module lazily imported from the click handler, producing a
 * downloadable artifact on the member's own device. The composite is drawn
 * from their REAL uploaded photos on a canvas — nothing is ever generated or
 * redrawn by a model. Brand palette matches lib/pdf/weekly-report-pdf.ts.
 */

const INK = "#0b0b0d";
const PANEL = "#141417";
const BONE = "#e7e4df";
const MUTED = "rgba(231, 228, 223, 0.62)";
const FAINT = "rgba(231, 228, 223, 0.4)";
const BLOOD = "#a4161a";
const BLOOD_BRIGHT = "#ff453a";
const LINE = "rgba(231, 228, 223, 0.14)";

const FRAME_W = 480;
const FRAME_H = 600;
const PAD = 40;
const GAP = 24;
const HEADER_H = 104;
const CAPTION_H = 150;
const FOOTER_H = 56;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Blob photos are public + CORS-enabled; anonymous keeps the canvas clean
    // so toBlob works. A tainted canvas rejects and the caller shows a toast.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/** Word-wrap `text` to `maxWidth`, returning the drawn line count. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines - 1) {
        break;
      }
    } else {
      line = attempt;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines += 1;
  }
  return lines;
}

/** Cover-crop draw (object-fit: cover) into the given box. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Render the montage to a PNG blob and trigger a download. */
export async function downloadMontagePng(
  content: ProgressMontageContent
): Promise<void> {
  const images = await Promise.all(
    content.frames.map((f) => loadImage(f.photoUrl))
  );

  const n = content.frames.length;
  const width = PAD * 2 + n * FRAME_W + (n - 1) * GAP;

  // Pre-measure the verdict so the canvas is exactly tall enough.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) {
    throw new Error("Canvas unsupported");
  }
  measure.font = "400 26px system-ui, sans-serif";
  const verdictWidth = width - PAD * 2 - 48;
  const approxLines = Math.min(
    8,
    Math.max(
      2,
      Math.ceil(measure.measureText(content.verdict).width / verdictWidth)
    )
  );
  const verdictH = 96 + approxLines * 36;

  const height = HEADER_H + FRAME_H + CAPTION_H + verdictH + FOOTER_H + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unsupported");
  }

  // Field
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  // Header: CHAD wordmark + artifact label
  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.fillText("CHAD", PAD, 62);
  const chadW = ctx.measureText("CHAD").width;
  ctx.fillStyle = MUTED;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("PROGRESS MONTAGE", PAD + chadW + 18, 60);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_H - 20);
  ctx.lineTo(width - PAD, HEADER_H - 20);
  ctx.stroke();

  // Frames
  content.frames.forEach((frame, i) => {
    const x = PAD + i * (FRAME_W + GAP);
    const y = HEADER_H;

    drawCover(ctx, images[i], x, y, FRAME_W, FRAME_H);
    ctx.strokeStyle = LINE;
    ctx.strokeRect(x + 0.5, y + 0.5, FRAME_W - 1, FRAME_H - 1);

    // Date + weight chip row
    let ty = y + FRAME_H + 40;
    ctx.fillStyle = BONE;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(frame.dateLabel, x, ty);
    if (frame.weightLabel) {
      const dateW = ctx.measureText(frame.dateLabel).width;
      ctx.fillStyle = FAINT;
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillText(frame.weightLabel, x + dateW + 16, ty);
    }

    // Chad's caption
    ty += 38;
    ctx.fillStyle = MUTED;
    ctx.font = "400 22px system-ui, sans-serif";
    drawWrapped(ctx, frame.caption, x, ty, FRAME_W - 8, 30, 3);
  });

  // Verdict block
  const vy = HEADER_H + FRAME_H + CAPTION_H;
  ctx.fillStyle = PANEL;
  ctx.fillRect(PAD, vy, width - PAD * 2, verdictH - 24);
  ctx.strokeStyle = "rgba(164, 22, 26, 0.55)";
  ctx.strokeRect(PAD + 0.5, vy + 0.5, width - PAD * 2 - 1, verdictH - 25);
  ctx.fillStyle = BLOOD_BRIGHT;
  ctx.font = "800 20px system-ui, sans-serif";
  ctx.fillText("CHAD'S VERDICT", PAD + 24, vy + 44);
  ctx.fillStyle = BONE;
  ctx.font = "400 26px system-ui, sans-serif";
  drawWrapped(
    ctx,
    content.verdict,
    PAD + 24,
    vy + 88,
    verdictWidth,
    36,
    approxLines + 1
  );

  // Footer
  ctx.fillStyle = FAINT;
  ctx.font = "600 20px system-ui, sans-serif";
  const site = "chadcoach.ai";
  ctx.fillText(site, width - PAD - ctx.measureText(site).width, height - 28);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) {
    throw new Error("Failed to export the montage");
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chad-progress-montage.png";
  a.click();
  URL.revokeObjectURL(url);
}
