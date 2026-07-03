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
    setStarting(true);

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {
          /* autoplay block - the paused first frame still scans */
        });
      }
      setStarting(false);

      interval = setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || firedRef.current) {
          return;
        }
        try {
          const codes = await detector.detect(v);
          const digits = codes[0]?.rawValue?.replace(/\D/g, "");
          if (digits && digits.length >= 8) {
            fire(digits);
          }
        } catch {
          /* skip this frame */
        }
      }, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
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
            {/* Aiming guide */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/70"
            />
          </div>
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
