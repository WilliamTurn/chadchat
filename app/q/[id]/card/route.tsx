import { ImageResponse } from "next/og";
import { getQuitShareView } from "@/lib/quit/share-view";

/*
 * The social card image for a shared quit prediction (FEAT-23 pro-app share
 * flow): X/Facebook/iMessage unfurl the /q/[id] link into this 1200×630 image
 * — the share IS the card, no manual download-and-attach. Drawn server-side
 * with next/og from the same data as the page; ?v=receipt renders the receipt
 * variant when it's earned.
 */

export const maxDuration = 60;

const INK = "#0b0b0d";
const BONE = "#e7e4df";
const MUTED = "rgba(231, 228, 223, 0.62)";
const FAINT = "rgba(231, 228, 223, 0.4)";
const BLOOD_BRIGHT = "#ff453a";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const view = await getQuitShareView(id, url.searchParams.get("v") ?? undefined);
  if (!view) {
    return new Response("Not found", { status: 404 });
  }

  const header = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
      <div style={{ color: BLOOD_BRIGHT, fontSize: 44, fontWeight: 700 }}>
        CHAD
      </div>
      <div style={{ color: MUTED, fontSize: 26 }}>THE QUIT TEST</div>
    </div>
  );

  const footer = (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{ color: FAINT, fontSize: 24 }}>chadcoach.ai</div>
    </div>
  );

  const body =
    view.variant === "receipt" ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: BLOOD_BRIGHT, fontSize: 26, letterSpacing: 8 }}>
          THE RECEIPT
        </div>
        <div style={{ color: MUTED, fontSize: 44 }}>
          {`Chad gave me ${view.givenDays} days.`}
        </div>
        <div style={{ color: BLOOD_BRIGHT, fontSize: 92, fontWeight: 700 }}>
          {`I'm on day ${view.currentDay}.`}
        </div>
        <div style={{ color: BONE, fontSize: 32 }}>
          {`He called ${view.dateLabel}. Still here.`}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: BLOOD_BRIGHT, fontSize: 26, letterSpacing: 8 }}>
          THE VERDICT
        </div>
        <div style={{ color: BLOOD_BRIGHT, fontSize: 54, fontWeight: 700 }}>
          YOU WILL QUIT
        </div>
        <div style={{ color: BONE, fontSize: 84, fontWeight: 700 }}>
          {view.dateLabel}
        </div>
        <div style={{ color: MUTED, fontSize: 30 }}>
          {`Day ${view.dayCount} of my membership. ${view.failureMode}.`}
        </div>
      </div>
    );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: INK,
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      {header}
      {body}
      {footer}
    </div>,
    { width: 1200, height: 630 }
  );
}
