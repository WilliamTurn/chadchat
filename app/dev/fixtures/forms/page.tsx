import { FormsFixture } from "@/components/dev/forms-fixture";

/**
 * FORM AND FEEDBACK PRIMITIVES PAGE (FIX-38, P2-E harness).
 *
 * Every control x state, the shared validation pattern, button pending
 * states, the toast grammar, and the role-sized skeletons. Registered in
 * scripts/fixture-screenshots.mjs as `forms`.
 */
export default function FormsFixturePage() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-page-title">Form and feedback primitives</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          The input system every logger, settings page, and onboarding flow
          composes (FIX-38). One labeling grammar, one error pattern, one
          pending-state treatment, one toast grammar.
        </p>
      </div>
      <FormsFixture />
    </div>
  );
}
