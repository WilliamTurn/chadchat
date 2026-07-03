import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // bg-muted is nearly the same lightness as the card in dark mode, which
        // made every skeleton invisible (DS-15); a muted-foreground tint stays
        // visible on the card surface in both themes.
        "animate-pulse rounded-xl bg-muted-foreground/20",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
