import Link from "next/link";
import { Toaster } from "sonner";
import {
  ConfirmDemo,
  DetailSheetDemo,
  EditEntryOverlayDemo,
  QuickLogOverlayDemo,
  UndoQuickAddDemo,
} from "./demos";

/**
 * OVERLAY PLATFORM PAGE (P2-D harness, FIX-17 evidence surface).
 *
 * Every overlay pattern the platform ships, exercised on the real
 * components. `?open=quicklog|edit|confirm|sheet` opens one overlay on load
 * so the FIX-39 screenshot suite captures deterministic open states; the
 * param is a harness mechanism only.
 *
 * What auditors verify here (motion-interaction.md sections 4 to 6):
 *   - No input focused on any open, 390px and desktop alike.
 *   - Focus trap, escape-to-close, focus returned to the trigger.
 *   - Phone: bottom sheet with 20px top radius, drag handle, close button,
 *     sticky full-width primary action, safe-area padding.
 *   - Destructive confirm names the object and consequence; quick adds get
 *     an Undo toast that persists at least 5 seconds.
 *   - Dismissal never loses typed input (draft preservation).
 */

const DECISION_TREE = [
  ["Define a term, 1 to 3 sentences", 'Tooltip or "?" popover, dismissible'],
  ["One-tap non-destructive quick action", "Small popover, within viewport"],
  ["Short form (2 to 5 fields), desktop", "AdaptiveDialog (centered modal)"],
  ["Short form, phone", "AdaptiveDialog (bottom sheet)"],
  ["Confirmation of a destructive act", "ConfirmActionDialog (named object + consequence)"],
  ["Read-mostly detail preview", "Sheet (side drawer), detail page for depth"],
  [
    "Data entry beyond a few fields, or any core feature",
    "A dedicated full page with a back button, never a modal (owner law s168)",
  ],
  ["Meal logging, live workout", "Full-screen focused flow (a route, not an overlay)"],
] as const;

export default async function OverlaysFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;

  return (
    <div className="space-y-10">
      {/* Toasters mount per layout in this app (the forms fixture does the
          same); receipts and Undo need one on this surface too. */}
      <Toaster position="top-center" richColors theme="system" />
      <div className="space-y-3">
        <h1 className="text-page-title">Overlay platform</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          The shared quick-log, edit, detail, confirm, and drawer patterns
          (FIX-17) on the real platform components. Long forms and core
          features are dedicated pages by owner law; the platform ships no
          full-screen modal. Example:{" "}
          <Link className="underline underline-offset-3" href="/train">
            the workout session flow
          </Link>
          .
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-section-title">Patterns</h2>
        <div className="flex flex-wrap gap-3">
          <QuickLogOverlayDemo autoOpen={open === "quicklog"} />
          <EditEntryOverlayDemo autoOpen={open === "edit"} />
          <ConfirmDemo autoOpen={open === "confirm"} />
          <UndoQuickAddDemo />
          <DetailSheetDemo autoOpen={open === "sheet"} />
        </div>
        <ul className="max-w-prose list-disc space-y-1 pl-5 text-secondary text-muted-foreground">
          <li>
            Log water: the quick-log short form. Phone gets the bottom sheet
            with a sticky primary action; saving shows the receipt with Undo.
          </li>
          <li>
            Edit sleep entry: the correction form. Type a value, press
            Escape, reopen: the draft survives dismissal.
          </li>
          <li>
            Delete weigh-in: the destructive confirm. It names the exact
            object and the consequence, and shows a pending state while the
            delete runs.
          </li>
          <li>
            Quick-add with Undo: the optimistic path for one-tap logs; the
            Undo toast persists at least 5 seconds.
          </li>
          <li>
            Workout detail: the read-mostly side drawer with a scrollable
            body and a named link deeper.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-section-title">Overlay decision tree</h2>
        <p className="max-w-prose text-secondary text-muted-foreground">
          One rule, no per-card inventing (motion-interaction.md section 5).
          Dialog stacked on dialog is banned and logs a dev-build error.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-96 text-left text-secondary">
            <thead>
              <tr className="border-border border-b bg-surface-inset">
                <th className="px-4 py-2 font-medium">Need</th>
                <th className="px-4 py-2 font-medium">Surface</th>
              </tr>
            </thead>
            <tbody>
              {DECISION_TREE.map(([need, surface]) => (
                <tr className="border-border border-b last:border-b-0" key={need}>
                  <td className="px-4 py-2 align-top">{need}</td>
                  <td className="px-4 py-2 align-top text-muted-foreground">
                    {surface}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
