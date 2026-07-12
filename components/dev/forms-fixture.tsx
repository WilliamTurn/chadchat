"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberStepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastReceipt, toastUndo } from "@/components/ui/toast";
import { PANEL_ROLES, type PanelRole } from "@/lib/contracts/panels";

/**
 * FORM AND FEEDBACK FIXTURE MATRIX (FIX-38, P2-E harness page body).
 *
 * Every form control x state, the shared validation/error pattern, button
 * pending states, the toast grammar, and the role-sized skeletons, rendered
 * deterministically for the FIX-39 screenshot suite and the auditors.
 * Dates use the fixture anchor (2026-07-08), never the real clock.
 */
export function FormsFixture() {
  return (
    <div className="space-y-10">
      <TextInputsSection />
      <SelectsSection />
      <SteppersSection />
      <TogglesSection />
      <DatesSection />
      <TextareasSection />
      <ButtonsSection />
      <ToastsSection />
      <SkeletonsSection />
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-section-title">{title}</h2>
      <p className="max-w-prose text-muted-foreground text-secondary">
        {description}
      </p>
    </div>
  );
}

function StateCaption({ children }: { children: string }) {
  return (
    <p className="mb-2 text-meta text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  );
}

const CELL_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/* ----------------------------------------------------------------------- */

function TextInputsSection() {
  return (
    <section className="space-y-4" data-testid="section-text-inputs">
      <SectionHeader
        description="Labels carry the unit; placeholders show an example value. The invalid cell is the one error pattern every form uses: aria-invalid ring on the control, role=alert message below it, the typed value kept."
        title="Text inputs"
      />
      <div className={CELL_GRID}>
        <div data-testid="input-rest">
          <StateCaption>rest</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-weight">Weight (lb)</FieldLabel>
            <Input id="fx-weight" placeholder="205.8" size="lg" />
          </Field>
        </div>
        <div data-testid="input-filled">
          <StateCaption>filled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-weight-filled">Weight (lb)</FieldLabel>
            <Input
              defaultValue="205.8"
              id="fx-weight-filled"
              inputMode="decimal"
              size="lg"
            />
          </Field>
        </div>
        <div data-testid="input-invalid">
          <StateCaption>invalid</StateCaption>
          <Field invalid>
            <FieldLabel htmlFor="fx-amount-invalid">Amount (oz)</FieldLabel>
            <Input
              aria-describedby="fx-amount-invalid-error"
              aria-invalid
              defaultValue="250"
              id="fx-amount-invalid"
              inputMode="decimal"
              size="lg"
            />
            <FieldError id="fx-amount-invalid-error">
              Enter an amount between 1 and 128 oz. Your entry is still here.
            </FieldError>
          </Field>
        </div>
        <div data-testid="input-disabled">
          <StateCaption>disabled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-weight-disabled">Weight (lb)</FieldLabel>
            <Input
              defaultValue="205.8"
              disabled
              id="fx-weight-disabled"
              size="lg"
            />
          </Field>
        </div>
      </div>
      <div data-testid="input-with-description">
        <StateCaption>with description</StateCaption>
        <Field className="max-w-sm">
          <FieldLabel htmlFor="fx-goal">Daily water goal (oz)</FieldLabel>
          <Input
            defaultValue="128"
            id="fx-goal"
            inputMode="numeric"
            size="lg"
          />
          <FieldDescription>
            Applies from today forward. Past days keep the goal they were
            logged against.
          </FieldDescription>
        </Field>
      </div>
    </section>
  );
}

function SelectsSection() {
  const options = (
    <SelectContent>
      <SelectItem value="poor">Poor</SelectItem>
      <SelectItem value="fair">Fair</SelectItem>
      <SelectItem value="good">Good</SelectItem>
      <SelectItem value="excellent">Excellent</SelectItem>
    </SelectContent>
  );
  return (
    <section className="space-y-4" data-testid="section-selects">
      <SectionHeader
        description="Select triggers use the same touch-safe height, focus ring, and invalid treatment as text inputs."
        title="Selects"
      />
      <div className={CELL_GRID}>
        <div data-testid="select-rest">
          <StateCaption>rest</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-quality">Sleep quality</FieldLabel>
            <Select>
              <SelectTrigger className="w-full" id="fx-quality" size="lg">
                <SelectValue placeholder="Good" />
              </SelectTrigger>
              {options}
            </Select>
          </Field>
        </div>
        <div data-testid="select-valued">
          <StateCaption>valued</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-quality-valued">Sleep quality</FieldLabel>
            <Select defaultValue="good">
              <SelectTrigger
                className="w-full"
                id="fx-quality-valued"
                size="lg"
              >
                <SelectValue />
              </SelectTrigger>
              {options}
            </Select>
          </Field>
        </div>
        <div data-testid="select-invalid">
          <StateCaption>invalid</StateCaption>
          <Field invalid>
            <FieldLabel htmlFor="fx-quality-invalid">Sleep quality</FieldLabel>
            <Select>
              <SelectTrigger
                aria-describedby="fx-quality-invalid-error"
                aria-invalid
                className="w-full"
                id="fx-quality-invalid"
                size="lg"
              >
                <SelectValue placeholder="Good" />
              </SelectTrigger>
              {options}
            </Select>
            <FieldError id="fx-quality-invalid-error">
              Choose a sleep quality to save this entry.
            </FieldError>
          </Field>
        </div>
        <div data-testid="select-disabled">
          <StateCaption>disabled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-quality-disabled">Sleep quality</FieldLabel>
            <Select defaultValue="good" disabled>
              <SelectTrigger
                className="w-full"
                id="fx-quality-disabled"
                size="lg"
              >
                <SelectValue />
              </SelectTrigger>
              {options}
            </Select>
          </Field>
        </div>
      </div>
    </section>
  );
}

function SteppersSection() {
  const [amount, setAmount] = useState(20);
  return (
    <section className="space-y-4" data-testid="section-steppers">
      <SectionHeader
        description="The quantity control for bounded numeric entry. Buttons are 44px on touch and disable at the bounds; the center value stays keyboard-editable and snaps to the step on blur."
        title="Steppers"
      />
      <div className={CELL_GRID}>
        <div data-testid="stepper-interactive">
          <StateCaption>interactive</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-oz">Amount (oz)</FieldLabel>
            <NumberStepper
              id="fx-oz"
              label="Amount (oz)"
              max={128}
              min={0}
              onChange={setAmount}
              step={4}
              value={amount}
            />
          </Field>
        </div>
        <div data-testid="stepper-at-min">
          <StateCaption>at minimum</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-oz-min">Amount (oz)</FieldLabel>
            <NumberStepper
              id="fx-oz-min"
              label="Amount (oz)"
              max={128}
              min={0}
              onChange={() => undefined}
              step={4}
              value={0}
            />
          </Field>
        </div>
        <div data-testid="stepper-at-max">
          <StateCaption>at maximum</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-oz-max">Amount (oz)</FieldLabel>
            <NumberStepper
              id="fx-oz-max"
              label="Amount (oz)"
              max={128}
              min={0}
              onChange={() => undefined}
              step={4}
              value={128}
            />
          </Field>
        </div>
        <div data-testid="stepper-disabled">
          <StateCaption>disabled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-oz-disabled">Amount (oz)</FieldLabel>
            <NumberStepper
              disabled
              id="fx-oz-disabled"
              label="Amount (oz)"
              max={128}
              min={0}
              onChange={() => undefined}
              step={4}
              value={20}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

function TogglesSection() {
  const [emailOn, setEmailOn] = useState(true);
  return (
    <section className="space-y-4" data-testid="section-toggles">
      <SectionHeader
        description="Settings rows pair the switch with a label and consequence description; the hit area is 44px even though the track is smaller."
        title="Toggles"
      />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div data-testid="toggle-on">
          <StateCaption>on, interactive</StateCaption>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="fx-report-email">
                Weekly report email
              </FieldLabel>
              <FieldDescription>Sends Monday morning.</FieldDescription>
            </FieldContent>
            <Switch
              checked={emailOn}
              id="fx-report-email"
              onCheckedChange={setEmailOn}
            />
          </Field>
        </div>
        <div data-testid="toggle-off">
          <StateCaption>off</StateCaption>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="fx-reminders">Workout reminders</FieldLabel>
              <FieldDescription>
                One reminder at your usual training time.
              </FieldDescription>
            </FieldContent>
            <Switch id="fx-reminders" />
          </Field>
        </div>
        <div data-testid="toggle-disabled">
          <StateCaption>disabled</StateCaption>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="fx-sms">Text message check-ins</FieldLabel>
              <FieldDescription>Add a phone number first.</FieldDescription>
            </FieldContent>
            <Switch disabled id="fx-sms" />
          </Field>
        </div>
      </div>
    </section>
  );
}

function DatesSection() {
  const [logDay, setLogDay] = useState("2026-07-06");
  const [emptyDay, setEmptyDay] = useState("");
  return (
    <section className="space-y-4" data-testid="section-dates">
      <SectionHeader
        description="The backfill date field: capped at the fixture's today (2026-07-08), so a member can log a past day but never a future one."
        title="Date picker"
      />
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div data-testid="date-valued">
          <StateCaption>valued</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-log-day">Day to log</FieldLabel>
            <DatePicker
              className="h-11 md:h-10"
              id="fx-log-day"
              max="2026-07-08"
              onChange={setLogDay}
              value={logDay}
            />
          </Field>
        </div>
        <div data-testid="date-empty">
          <StateCaption>empty</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-log-day-empty">Day to log</FieldLabel>
            <DatePicker
              className="h-11 md:h-10"
              id="fx-log-day-empty"
              max="2026-07-08"
              onChange={setEmptyDay}
              placeholder="Pick a day"
              value={emptyDay}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

function TextareasSection() {
  return (
    <section className="space-y-4" data-testid="section-textareas">
      <SectionHeader
        description="Free-text entry with the same border, focus, and invalid grammar as inputs."
        title="Textareas"
      />
      <div className={CELL_GRID}>
        <div data-testid="textarea-rest">
          <StateCaption>rest</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-notes">Workout notes</FieldLabel>
            <Textarea
              id="fx-notes"
              placeholder="Felt strong on squats, right knee fine."
            />
          </Field>
        </div>
        <div data-testid="textarea-filled">
          <StateCaption>filled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-notes-filled">Workout notes</FieldLabel>
            <Textarea
              defaultValue="Paused bench felt heavy. Cut the last set at 6 reps."
              id="fx-notes-filled"
            />
          </Field>
        </div>
        <div data-testid="textarea-invalid">
          <StateCaption>invalid</StateCaption>
          <Field invalid>
            <FieldLabel htmlFor="fx-notes-invalid">Workout notes</FieldLabel>
            <Textarea
              aria-describedby="fx-notes-invalid-error"
              aria-invalid
              defaultValue="A note that is far too long for the field..."
              id="fx-notes-invalid"
            />
            <FieldError id="fx-notes-invalid-error">
              Keep notes under 500 characters. Your text is still here.
            </FieldError>
          </Field>
        </div>
        <div data-testid="textarea-disabled">
          <StateCaption>disabled</StateCaption>
          <Field>
            <FieldLabel htmlFor="fx-notes-disabled">Workout notes</FieldLabel>
            <Textarea
              defaultValue="Logged by your coach."
              disabled
              id="fx-notes-disabled"
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

function ButtonsSection() {
  const [saving, setSaving] = useState(false);
  return (
    <section className="space-y-4" data-testid="section-buttons">
      <SectionHeader
        description="Every button ships default, hover, focus-visible, loading, and disabled states. Loading keeps the button's exact size (the label yields to a centered spinner), disables it, and sets aria-busy; no form hand-rolls its own pending state."
        title="Button states"
      />
      <div className="space-y-3">
        {(["default", "outline", "secondary", "ghost", "destructive"] as const).map(
          (variant) => (
            <div
              className="flex flex-wrap items-center gap-3"
              data-testid={`buttons-${variant}`}
              key={variant}
            >
              <span className="w-24 text-meta text-muted-foreground uppercase tracking-wide">
                {variant}
              </span>
              <Button size="lg" variant={variant}>
                Log water
              </Button>
              <Button loading size="lg" variant={variant}>
                Log water
              </Button>
              <Button disabled size="lg" variant={variant}>
                Log water
              </Button>
            </div>
          )
        )}
        <div
          className="flex flex-wrap items-center gap-3 pt-2"
          data-testid="buttons-live-demo"
        >
          <span className="w-24 text-meta text-muted-foreground uppercase tracking-wide">
            live
          </span>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => setSaving(false), 2000);
            }}
            size="lg"
          >
            Save entry
          </Button>
          <p className="text-muted-foreground text-secondary">
            Click to run the 2 second pending demo. Width must not change.
          </p>
        </div>
      </div>
    </section>
  );
}

function ToastsSection() {
  return (
    <section className="space-y-4" data-testid="section-toasts">
      <SectionHeader
        description="The three toast shapes: a concrete receipt after a meaningful save, an Undo toast after a quick add (persists 6 seconds), and an error that keeps the member's input. Sonner announces each to screen readers."
        title="Toasts and undo"
      />
      <div className="flex flex-wrap gap-3">
        <Button
          data-testid="toast-receipt-trigger"
          onClick={() =>
            toastReceipt("Added 20 oz. 64 oz remaining today.")
          }
          size="lg"
          variant="outline"
        >
          Show save receipt
        </Button>
        <Button
          data-testid="toast-undo-trigger"
          onClick={() =>
            toastUndo("Added 20 oz of water.", {
              onUndo: () => ({ ok: true }),
            })
          }
          size="lg"
          variant="outline"
        >
          Show undo toast
        </Button>
        <Button
          data-testid="toast-error-trigger"
          onClick={() =>
            toastError(
              "We couldn't save your sleep entry. Your values are still here. Try again."
            )
          }
          size="lg"
          variant="outline"
        >
          Show error toast
        </Button>
      </div>
    </section>
  );
}

function SkeletonsSection() {
  return (
    <section className="space-y-4" data-testid="section-skeletons">
      <SectionHeader
        description="Suspense fallbacks sized to each panel role's minimum height budget from the panel contract, so data arrival never shifts layout."
        title="Role-sized skeletons"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(PANEL_ROLES) as PanelRole[]).map((role) => (
          <div data-testid={`skeleton-${role}`} key={role}>
            <StateCaption>
              {`${role}, min ${PANEL_ROLES[role].heightRange[0]}px`}
            </StateCaption>
            <PanelSkeleton role={role} />
          </div>
        ))}
      </div>
    </section>
  );
}
