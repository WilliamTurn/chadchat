"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { useReward } from "@/components/dashboard/reward";
import { analyzeMeal } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/ui/photo-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Kind = "fridge" | "pantry" | "other";

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "fridge", label: "Fridge", hint: "What's in your fridge" },
  { value: "pantry", label: "Pantry", hint: "Your cupboard / staples" },
  {
    value: "other",
    label: "Other",
    hint: "Grocery cart, market haul, hotel room, anywhere",
  },
];

export function KitchenForm({
  onAnalyzingChange,
}: {
  onAnalyzingChange?: (analyzing: boolean) => void;
}) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<Kind>("fridge");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const busy = pending || uploading;
  const needsPhoto = !file;

  function pick(f: File | null) {
    setFile(f);
    setPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Add a photo first.");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    let photoUrl: string;
    let mediaType = "image/jpeg";
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: "Upload failed." }));
        toast.error(error ?? "Upload failed.");
        setUploading(false);
        return;
      }
      const data = await res.json();
      photoUrl = data.url;
      mediaType = data.contentType === "image/png" ? "image/png" : "image/jpeg";
    } catch {
      toast.error("Upload failed — try again.");
      setUploading(false);
      return;
    }
    setUploading(false);

    onAnalyzingChange?.(true);
    startTransition(async () => {
      const result = await analyzeMeal({
        photoUrl,
        mediaType: mediaType as "image/jpeg" | "image/png",
        kind,
        note: note.trim() || null,
      });
      if (result.ok) {
        reward.celebrate("Chad's verdict is in.");
        setNote("");
        pick(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't analyze that.");
      }
      onAnalyzingChange?.(false);
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div>
        <h2 className="font-medium text-lg">Rate My Kitchen</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Photograph your fridge, your pantry, or any food around you: a
          grocery cart, a market haul, a hotel minibar. Chad rates whatever
          you show him: what to keep, what to toss, what to pick instead.
        </p>
      </div>

      {/* Kind selector */}
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
        {KINDS.map((k) => {
          const active = kind === k.value;
          return (
            <button
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-blood bg-blood/10"
                  : "border-border bg-background/40 hover:bg-accent/50"
              }`}
              key={k.value}
              onClick={() => setKind(k.value)}
              type="button"
            >
              <div className="font-medium text-sm">{k.label}</div>
              <div className="text-muted-foreground text-[11px] leading-tight">
                {k.hint}
              </div>
            </button>
          );
        })}
      </div>

      {/* Photo drop / picker */}
      <PhotoInput
        hint="Add a photo"
        note="JPEG or PNG, up to 5MB"
        onSelect={(files) => pick(files[0] ?? null)}
        preview={preview}
        previewAlt="Selected"
      />

      <Textarea
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything Chad should know? (optional), e.g. 'shared house', 'on a cut', 'shopping for the week'"
        rows={2}
        value={note}
      />

      {/* No photo yet = live, brand-tinted "add a photo" affordance instead of a
          disabled slab that reads as an enabled button (VF-19; same pattern as
          the nutrition form's NUT-15 treatment). */}
      <Button
        className={cn(
          "gap-2",
          needsPhoto &&
            "border border-blood/40 bg-blood/5 text-blood hover:bg-blood/10"
        )}
        disabled={busy}
        size="lg"
        type="submit"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {!busy && needsPhoto && <Camera className="size-4" />}
        {needsPhoto
          ? "Add a photo to analyze"
          : uploading
            ? "Uploading…"
            : pending
              ? "Chad's analyzing…"
              : "Analyze with Chad"}
      </Button>
    </form>
  );
}
