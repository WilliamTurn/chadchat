"use client";

import type { LucideIcon } from "lucide-react";
import { Camera, Images } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * THE app photo input (RC-4: SYS-22, NUT-14, BOD-08). Every photo affordance
 * renders through this component so a phone can always open the camera in one
 * tap AND still pick from the gallery.
 *
 * Mechanism: two explicit affordances drive a hidden input PAIR. "Take photo"
 * carries capture="environment" (phones open the rear camera directly);
 * "Choose from gallery" omits capture, because a single input with capture
 * forces camera-ONLY on many Android browsers and would kill the gallery
 * path. Desktop browsers ignore capture, so both buttons degrade to the
 * normal file picker. iOS Safari opens the camera for the capture input and
 * its Photo Library sheet for the plain one.
 *
 * Call sites own their file state, upload, and submit flow; this component
 * only surfaces the picked files via onSelect (the inputs self-clear so the
 * same file can be re-picked). Adding a raw image <input type="file">
 * anywhere else fails the build (design-lint rule raw-photo-input).
 */
export function PhotoInput({
  accept = "image/png,image/jpeg",
  className,
  disabled = false,
  hint,
  icon: Icon = Camera,
  inputId,
  multiple = false,
  note,
  onSelect,
  preview,
  previewAlt = "Selected photo",
  variant = "dropzone",
}: {
  accept?: string;
  className?: string;
  disabled?: boolean;
  /** Empty-state line naming what to photograph, e.g. "Add a photo of your food". */
  hint?: string;
  /** Empty-state icon above the hint (defaults to the camera). */
  icon?: LucideIcon;
  /** id for the gallery input, so an external <Label htmlFor> keeps working. */
  inputId?: string;
  multiple?: boolean;
  /** File-type note under the hint, e.g. "JPEG or PNG, up to 5MB". */
  note?: string;
  onSelect: (files: File[]) => void;
  /** Object URL (or remote URL) of the chosen photo; replaces the empty state. */
  preview?: string | null;
  previewAlt?: string;
  /** "dropzone" = bordered zone with preview/hint; "buttons" = the two affordances only. */
  variant?: "dropzone" | "buttons";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Self-clear so picking the same file again still fires a change event.
    e.target.value = "";
    if (files.length > 0) {
      onSelect(files);
    }
  }

  const affordances = (
    // flex-wrap + basis (not a viewport breakpoint): the buttons sit side by
    // side only when the CONTAINER fits both, so a narrow desktop column
    // stacks them just like a phone does.
    <div className="flex w-full flex-wrap gap-2">
      <Button
        className="grow basis-48"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        size="lg"
        type="button"
        variant="outline"
      >
        <Camera className="size-4" />
        Take photo
      </Button>
      <Button
        className="grow basis-48"
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
        size="lg"
        type="button"
        variant="outline"
      >
        <Images className="size-4" />
        Choose from gallery
      </Button>
      <input
        accept={accept}
        capture="environment"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={cameraRef}
        type="file"
      />
      <input
        accept={accept}
        className="hidden"
        id={inputId}
        multiple={multiple}
        onChange={handleChange}
        ref={galleryRef}
        type="file"
      />
    </div>
  );

  if (variant === "buttons") {
    return <div className={cn("w-full", className)}>{affordances}</div>;
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-2xl border border-border border-dashed bg-background/40 px-4 py-6",
        className
      )}
    >
      {preview ? (
        // biome-ignore lint/performance/noImgElement: local object-URL preview
        <img
          alt={previewAlt}
          className="max-h-64 w-auto rounded-lg object-contain"
          src={preview}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <Icon className="size-7 text-muted-foreground" />
          {hint ? <span className="font-medium text-sm">{hint}</span> : null}
          {note ? (
            <span className="text-muted-foreground text-xs">{note}</span>
          ) : null}
        </div>
      )}
      {affordances}
    </div>
  );
}
