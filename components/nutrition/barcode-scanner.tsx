"use client";

/**
 * Camera barcode scanner for the Calorie Tracker's Search tab (FN-1).
 *
 * Uses the spec BarcodeDetector API via the `barcode-detector` ponyfill
 * (zxing-wasm) on EVERY browser - native support is patchy (no Safari,
 * flaky desktop Chrome), and one deterministic engine beats a per-browser
 * lottery for a core logging path. The wasm binary is served same-origin
 * from /zxing/zxing_reader.wasm (copied from node_modules - re-copy it when
 * the barcode-detector/zxing-wasm dependency is bumped) so scanning never
 * depends on a third-party CDN.
 *
 * A "type the number" fallback is always offered: damaged codes, denied
 * camera permission, and desktop users without a webcam all still work.
 */

import { Keyboard, Loader2, ScanBarcode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type DetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

// The 1D retail formats food barcodes use. QR etc. are deliberately off -
// fewer formats = faster, more reliable frames.
const FOOD_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

const SCAN_INTERVAL_MS = 220;
// Consecutive detect() failures before we stop pretending and show the typed
// fallback (a broken engine used to fail silently forever - the camera kept
// rolling and members reasonably concluded there was no scanner at all).
const MAX_CONSECUTIVE_FAILURES = 20;
// After this long with no hit, show the hold-steady coaching line. Phone
// cameras usually need distance + a full frame; nobody knows that untold.
const HINT_AFTER_MS = 5000;

/**
 * Phone-camera tuning after the stream starts. Stock getUserMedia streams are
 * the reason web barcode scanners "don't work" on phones: many Androids hand
 * back a lens without close focus, and iPhones won't macro-focus a barcode
 * held close. Continuous autofocus plus a modest zoom (the same trick the
 * mainstream scanner libraries use) makes close-up barcodes sharp enough to
 * decode. Every constraint is best-effort - unsupported ones are ignored.
 */
async function tuneTrackForScanning(track: MediaStreamTrack): Promise<void> {
  type Extra = {
    focusMode?: string[];
    zoom?: { min?: number; max?: number };
  };
  let caps: Extra = {};
  try {
    caps = (track.getCapabilities?.() ?? {}) as Extra;
  } catch {
    return;
  }
  const advanced: Record<string, unknown>[] = [];
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }
  if (caps.zoom && typeof caps.zoom.max === "number" && caps.zoom.max >= 2) {
    // 2x keeps the barcode inside the lens's focus range without the member
    // having to shove the package against the camera.
    advanced.push({ zoom: Math.min(2, caps.zoom.max) });
  }
  if (advanced.length > 0) {
    await track
      .applyConstraints({ advanced } as MediaTrackConstraints)
      .catch(() => {
        /* best-effort */
      });
  }
}

async function createDetector(): Promise<DetectorLike> {
  const { BarcodeDetector, prepareZXingModule } = await import(
    "barcode-detector/ponyfill"
  );
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: [...FOOD_BARCODE_FORMATS] });
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires once per open with the scanned/typed digit string. */
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const firedRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [showHint, setShowHint] = useState(false);

  const fire = useCallback(
    (code: string) => {
      if (firedRef.current) {
        return;
      }
      firedRef.current = true;
      onOpenChange(false);
      onDetected(code);
    },
    [onDetected, onOpenChange]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    firedRef.current = false;
    setCameraError(null);
    setManual("");
    setShowHint(false);
    setStarting(true);

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let hintTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      let detector: DetectorLike;
      try {
        detector = await createDetector();
      } catch {
        if (!cancelled) {
          setStarting(false);
          setCameraError(
            "The scanner couldn't load. Type the barcode number below instead."
          );
        }
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            // 1080p ideal: 1D decoding lives and dies by horizontal pixels
            // across the bars; browsers that can't deliver it degrade fine.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (err) {
        if (!cancelled) {
          setStarting(false);
          setCameraError(
            err instanceof DOMException && err.name === "NotAllowedError"
              ? "Camera access is blocked. Allow it in your browser, or type the barcode number below."
              : "No camera available. Type the barcode number below instead."
          );
        }
        return;
      }
      if (cancelled) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        await tuneTrackForScanning(track);
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {
          /* autoplay block - the paused first frame still scans */
        });
      }
      setStarting(false);
      hintTimer = setTimeout(() => {
        if (!(cancelled || firedRef.current)) {
          setShowHint(true);
        }
      }, HINT_AFTER_MS);

      let failures = 0;
      interval = setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || firedRef.current) {
          return;
        }
        try {
          const codes = await detector.detect(v);
          failures = 0;
          const digits = codes[0]?.rawValue?.replace(/\D/g, "");
          if (digits && digits.length >= 8) {
            fire(digits);
          }
        } catch {
          // A frame can fail transiently, but detect() failing continuously
          // means the engine is down on this device - say so instead of
          // showing a camera that will never scan.
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_FAILURES && !cancelled) {
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
            if (streamRef.current) {
              for (const t of streamRef.current.getTracks()) {
                t.stop();
              }
              streamRef.current = null;
            }
            setCameraError(
              "Scanning isn't working on this device. Type the barcode number below instead."
            );
          }
        }
      }, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
      if (hintTimer) {
        clearTimeout(hintTimer);
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [open, fire]);

  const manualDigits = manual.replace(/\D/g, "");
  const manualValid = manualDigits.length >= 8 && manualDigits.length <= 14;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="size-5" />
            Scan a barcode
          </DialogTitle>
          <DialogDescription>
            Point the camera at the barcode on the package. It logs with the
            product's exact label numbers.
          </DialogDescription>
        </DialogHeader>

        {cameraError ? (
          <p className="rounded-xl border border-border border-dashed bg-background/40 px-4 py-6 text-center text-muted-foreground text-sm">
            {cameraError}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
            {/* biome-ignore lint/a11y/useMediaCaption: live camera preview */}
            <video
              autoPlay
              className="aspect-[4/3] w-full object-cover"
              muted
              playsInline
              ref={videoRef}
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/90">
                <Loader2 className="size-4 animate-spin" />
                Starting camera…
              </div>
            )}
            {/* Aiming guide + sweeping red scan line (laser-scanner style,
                so it unmistakably reads as an active scanner) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 overflow-hidden rounded-lg border-2 border-white/70"
            >
              {!starting && (
                <div className="barcode-scan-line absolute inset-x-1 h-0.5 rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.8)]" />
              )}
            </div>
            {/* Live "scanning" pulse so it reads as an active scanner, not a
                plain camera view. */}
            {!starting && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/90">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  Scanning for a barcode…
                </span>
              </div>
            )}
          </div>
        )}
        {!cameraError && showHint && (
          <p className="text-muted-foreground text-xs">
            Not catching? Hold the package steady about 6 inches (15 cm) away
            and let the barcode fill the white frame.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Keyboard className="size-3.5" />
            Can't scan? Type the number printed under the barcode.
          </span>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              maxLength={14}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (manualValid) {
                    fire(manualDigits);
                  }
                }
              }}
              placeholder="e.g. 038000138416"
              value={manual}
            />
            <Button
              disabled={!manualValid}
              onClick={() => fire(manualDigits)}
              type="button"
              variant="secondary"
            >
              Look up
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
