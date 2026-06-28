"use client";

import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";

/**
 * Branded date field (DSH-10) — a Button trigger + Popover + shadcn Calendar,
 * replacing the off-brand native `<input type="date">`. Keeps the exact same
 * value contract (an ISO `yyyy-MM-dd` string) so it's a drop-in for the log
 * forms, which all store/cap dates as ISO day strings in local time.
 */
export function DatePicker({
  value,
  onChange,
  max,
  min,
  id,
  className,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, ISO, new Date()) : undefined;
  const maxDate = max ? parse(max, ISO, new Date()) : undefined;
  const minDate = min ? parse(min, ISO, new Date()) : undefined;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-9 w-full justify-start gap-2 px-3 font-normal",
            !value && "text-muted-foreground",
            className
          )}
          id={id}
          type="button"
          variant="outline"
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          {selected ? format(selected, "EEE, MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          autoFocus
          defaultMonth={selected}
          disabled={[
            ...(maxDate ? [{ after: maxDate }] : []),
            ...(minDate ? [{ before: minDate }] : []),
          ]}
          mode="single"
          onSelect={(day) => {
            if (day) {
              onChange(format(day, ISO));
              setOpen(false);
            }
          }}
          selected={selected}
        />
      </PopoverContent>
    </Popover>
  );
}
