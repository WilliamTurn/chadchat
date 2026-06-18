"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeMeal } from "@/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Kind = "meal" | "fridge" | "pantry";

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "meal", label: "Meal", hint: "A plate you're about to eat" },
  { value: "fridge", label: "Fridge", hint: "What's in your fridge" },
  { value: "pantry", label: "Pantry", hint: "Your cupboard / staples" },
];

export function AnalyzeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<Kind>("meal");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = pending || uploading;

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

    startTransition(async () => {
      const result = await analyzeMeal({
        photoUrl,
        mediaType: mediaType as "image/jpeg" | "image/png",
        kind,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Chad's verdict is in.");
        setNote("");
        pick(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't analyze that.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {/* Kind selector */}
      <div className="grid grid-cols-3 gap-2">
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
      <button
        className="relative flex min-h-44 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border border-dashed bg-background/40 px-4 py-6 text-center transition-colors hover:bg-accent/40"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {preview ? (
          // biome-ignore lint/performance/noImgElement: local object-URL preview
          <img
            alt="Selected"
            className="max-h-64 w-auto rounded-lg object-contain"
            src={preview}
          />
        ) : (
          <>
            <Camera className="size-7 text-muted-foreground" />
            <span className="font-medium text-sm">Tap to add a photo</span>
            <span className="text-muted-foreground text-xs">
              JPEG or PNG, up to 5MB
            </span>
          </>
        )}
      </button>
      <input
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />

      <Textarea
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything Chad should know? (optional) — e.g. 'post-workout', 'cutting'"
        rows={2}
        value={note}
      />

      <Button className="gap-2" disabled={busy || !file} size="lg" type="submit">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {uploading
          ? "Uploading…"
          : pending
            ? "Chad's analyzing…"
            : "Analyze with Chad"}
      </Button>
    </form>
  );
}
