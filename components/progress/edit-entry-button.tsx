"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { editProgressEntry } from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function EditEntryButton({
  id,
  recordedAt,
  weight,
  unit,
  note,
}: {
  id: string;
  recordedAt: string; // ISO yyyy-mm-dd
  weight: number | null;
  unit: "lb" | "kg";
  note: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(recordedAt);
  const [w, setW] = useState(weight == null ? "" : String(weight));
  const [u, setU] = useState<"lb" | "kg">(unit);
  const [n, setN] = useState(note ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const weightNum = w.trim() ? Number(w) : null;
    if (w.trim() && (Number.isNaN(weightNum) || (weightNum ?? 0) <= 0)) {
      toast.error("Enter a valid weight.");
      return;
    }
    startTransition(async () => {
      const result = await editProgressEntry({
        id,
        recordedAt: date,
        weight: weightNum,
        unit: u,
        note: n.trim() || null,
      });
      if (result.ok) {
        toast.success("Updated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't update that entry.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Edit entry"
          className="size-7 text-muted-foreground"
          size="icon"
          variant="ghost"
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit entry</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-date">Date</Label>
              <DatePicker
                id="e-date"
                onChange={setDate}
                value={date}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-weight">Weight</Label>
              <div className="flex gap-2">
                <Input
                  id="e-weight"
                  inputMode="decimal"
                  onChange={(ev) => setW(ev.target.value)}
                  placeholder="e.g. 184.5"
                  value={w}
                />
                <Select
                  onValueChange={(v) => setU(v as "lb" | "kg")}
                  value={u}
                >
                  <SelectTrigger
                    aria-label="Weight unit"
                    className="h-9 shrink-0 rounded-lg"
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
            <Label htmlFor="e-note">Note (optional)</Label>
            <Textarea
              id="e-note"
              maxLength={500}
              onChange={(ev) => setN(ev.target.value)}
              rows={2}
              value={n}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
