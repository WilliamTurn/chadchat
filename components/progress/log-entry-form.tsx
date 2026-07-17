"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { useReward } from "@/components/dashboard/reward";
import { addProgressEntry } from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoInput } from "@/components/ui/photo-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayLocalISO } from "@/lib/date";

const todayISO = todayLocalISO;

export function LogEntryForm({ defaultUnit }: { defaultUnit: "lb" | "kg" }) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"lb" | "kg">(defaultUnit);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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
        toast.error("Upload failed. Try again.");
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
        reward.celebrate("Logged.");
        setWeight("");
        setNote("");
        pick(null);
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
          <DatePicker
            className="min-h-11 sm:min-h-9"
            id="p-date"
            max={todayISO()}
            onChange={setDate}
            value={date}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="p-weight">Weight</Label>
          <div className="flex gap-2">
            <Input
              className="min-h-11 sm:min-h-9"
              id="p-weight"
              inputMode="decimal"
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 184.5"
              value={weight}
            />
            <Select
              onValueChange={(v) => setUnit(v as "lb" | "kg")}
              value={unit}
            >
              <SelectTrigger
                aria-label="Weight unit"
                className="min-h-11 shrink-0 rounded-lg sm:h-9 sm:min-h-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lb">lb</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
              </SelectContent>
            </Select>
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
        <PhotoInput
          hint="Add a progress photo"
          inputId="p-photo"
          note="JPEG or PNG"
          onSelect={(files) => pick(files[0] ?? null)}
          preview={preview}
          previewAlt="Selected progress photo"
        />
      </div>

      <Button className="min-h-11 sm:min-h-9 sm:w-auto" disabled={busy} type="submit">
        {uploading ? "Uploading…" : pending ? "Saving…" : "Log entry"}
      </Button>
    </form>
  );
}
