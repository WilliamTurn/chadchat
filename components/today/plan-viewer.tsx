"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Opens Chad's full training plan in a dialog — the card only shows a preview. */
export function PlanViewer({ plan }: { plan: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="mt-3 w-fit px-0 text-blood" size="sm" variant="link">
          View full plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your training plan</DialogTitle>
          <DialogDescription>
            The plan Chad has on file for you. Ask him in chat to change it.
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-line text-sm leading-relaxed">{plan}</div>
      </DialogContent>
    </Dialog>
  );
}
