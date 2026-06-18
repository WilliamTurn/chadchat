"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { addProgressEntry } from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function LogEntryForm({ defaultUnit }: { defaultUnit: "lb" | "kg" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"lb" | "kg">(defaultUnit);
  const [note, setNote] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const busy = pending || uploading;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const weightNum = weight.trim() ? Number(weight) : null;
    if (weight.trim() && (Number.isNaN(weightNum) || (weightNum ?? 0) <= 0)) {
      toast.error("Enter a valid weight.");
      return;
    }
    if (!(weightNum || note.trim() || file)) {
      toast.error("Add a weight, a photo, or a note.");
      return;
    }

    let photoUrl: string | null = null;
    if (file) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
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
      } catch {
        toast.error("Upload failed — try again.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(async () => {
      const result = await addProgressEntry({
        recordedAt: date,
        weight: weightNum,
        unit,
        note: note.trim() || null,
        photoUrl,
      });
      if (result.ok) {
        toast.success("Logged.");
        setWeight("");
        setNote("");
        setFile(null);
        setFileKey((k) => k + 1);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save that entry.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="p-date">Date</Label>
          <Input
            id="p-date"
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            value={date}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="p-weight">Weight</Label>
          <div className="flex gap-2">
            <Input
              id="p-weight"
              inputMode="decimal"
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 184.5"
              value={weight}
            />
            <select
              aria-label="Weight unit"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(e) => setUnit(e.target.value as "lb" | "kg")}
              value={unit}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="p-note">Note (optional)</Label>
        <Textarea
          id="p-note"
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How you're feeling, what changed…"
          rows={2}
          value={note}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="p-photo">Progress photo (optional)</Label>
        <Input
          accept="image/png,image/jpeg"
          id="p-photo"
          key={fileKey}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          type="file"
        />
      </div>

      <Button className="sm:w-auto" disabled={busy} type="submit">
        {uploading ? "Uploading…" : pending ? "Saving…" : "Log entry"}
      </Button>
    </form>
  );
}
