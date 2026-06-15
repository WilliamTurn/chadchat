"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, WarningIcon } from "./icons";

const iconsByType: Record<"success" | "error", ReactNode> = {
  success: <CheckCircleFillIcon />,
  error: <WarningIcon />,
};

export function toast(props: Omit<ToastProps, "id">) {
  return sonnerToast.custom(
    (id) => (
      <Toast description={props.description} id={id} type={props.type} />
    ),
    // Errors (e.g. hitting the daily message limit) stay until the user
    // dismisses them, so the message can't vanish before it's read.
    props.type === "error" ? { duration: Number.POSITIVE_INFINITY } : undefined
  );
}

function Toast(props: ToastProps) {
  const { id, type, description } = props;

  const descriptionRef = useRef<HTMLDivElement>(null);
  const [multiLine, setMultiLine] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) {
      return;
    }

    const update = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      const lines = Math.round(el.scrollHeight / lineHeight);
      setMultiLine(lines > 1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex toast-mobile:w-[420px] w-full justify-center">
      <div
        className={cn(
          "flex toast-mobile:w-full w-full flex-row gap-3 rounded-xl bg-card border border-border/50 shadow-[var(--shadow-float)] p-4",
          multiLine ? "items-start" : "items-center"
        )}
        data-testid="toast"
        key={id}
      >
        <div
          className={cn(
            "data-[type=error]:text-red-600 data-[type=success]:text-green-600",
            { "pt-0.5": multiLine }
          )}
          data-type={type}
        >
          {iconsByType[type]}
        </div>
        <div
          className="flex-1 text-[15px] leading-relaxed text-foreground"
          ref={descriptionRef}
        >
          {description}
        </div>
        <button
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 self-start rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => sonnerToast.dismiss(id)}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

type ToastProps = {
  id: string | number;
  type: "success" | "error";
  description: string;
};
