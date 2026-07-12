"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/**
 * FIELD PRIMITIVES (FIX-38, P2-E). The one labeling/validation/error grammar
 * every logger, settings page, and onboarding form composes. Adapted from the
 * upstream shadcn/ui `field` family, trimmed to this system's scope and
 * styled with explicit props instead of selector-variant utilities (FIX-37
 * lint rejects bracketed variants in new code).
 *
 * The validation contract (lib/contracts/copy.ts):
 *   - Labels carry the unit: "Amount (oz)", never only the placeholder.
 *   - Placeholders show an example value, not instructions.
 *   - Errors never blame and never lose input; the control keeps its value.
 *
 * Accessibility wiring (the SAME pattern react-hook-form's form.tsx renders,
 * for forms that manage their own state):
 *
 *   <Field invalid={!!error}>
 *     <FieldLabel htmlFor="amount">Amount (oz)</FieldLabel>
 *     <Input id="amount" size="lg" aria-invalid={!!error}
 *            aria-describedby={error ? "amount-error" : undefined} />
 *     <FieldError id="amount-error">{error}</FieldError>
 *   </Field>
 *
 * FieldError renders role="alert" so the message is announced by screen
 * readers when it appears; aria-invalid switches on the destructive
 * border/ring styling already built into every ui control.
 */

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      className={cn("flex flex-col gap-6", className)}
      data-slot="field-set"
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      className={cn(
        "mb-3 font-medium",
        variant === "legend" ? "text-base" : "text-sm",
        className
      )}
      data-slot="field-legend"
      data-variant={variant}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-6", className)}
      data-slot="field-group"
      {...props}
    />
  );
}

function Field({
  className,
  orientation = "vertical",
  invalid = false,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal";
  /** Turns the field's text destructive; pair with aria-invalid on the control. */
  invalid?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/field flex w-full gap-2",
        orientation === "vertical"
          ? "flex-col"
          : "flex-row items-center justify-between",
        invalid && "text-destructive",
        className
      )}
      data-invalid={invalid || undefined}
      data-orientation={orientation}
      data-slot="field"
      role="group"
      {...props}
    />
  );
}

/** Groups label + description on the text side of a horizontal field. */
function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-1.5 leading-snug", className)}
      data-slot="field-content"
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn("flex w-fit gap-2 leading-snug", className)}
      data-slot="field-label"
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-normal text-muted-foreground text-sm leading-normal",
        className
      )}
      data-slot="field-description"
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative -my-2 h-5 text-sm", className)}
      data-content={!!children}
      data-slot="field-separator"
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }
    if (!errors?.length) {
      return null;
    }
    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];
    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message;
    }
    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={cn("font-normal text-destructive text-sm", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
};
