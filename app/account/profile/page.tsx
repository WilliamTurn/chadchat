import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ProfileForm } from "@/components/account/profile-form";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { getUserById } from "@/lib/db/queries";

/**
 * Account > Your stats (W4): the profile form's own sub-screen, split out of
 * /account so that surface stays purely instant-apply (composition canon 05
 * #56: instant-apply and batch-save never mix on one screen) and the settings
 * list stays scannable (05 #58: past ~two screens of rows, split). Explicit
 * Save is correct here: a multi-field identity record with free-text areas is
 * the document-like side of ux-canon 01 #81. Precedent: /account/appearance
 * (s168 pages-not-popups law); Strava's Edit Profile.
 */
export default function ProfilePage() {
  return (
    <PageShell active="/account" className="max-w-[var(--container-content)]">
      <div className="mb-8">
        <BackLink href="/account" label="Account" />
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">
          Your stats
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          What Chad plans around. Update anything that has changed or that he
          has wrong.
        </p>
      </div>

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </PageShell>
  );
}

/** Flat placeholder mirroring the form column (canon 01 #73: loading keeps
 *  the group's rung, no card chrome). */
function ProfileSkeleton() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="h-4 w-24 animate-pulse rounded bg-muted-foreground/20" />
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted-foreground/20" />
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-11 w-40 animate-pulse rounded-lg bg-muted-foreground/20" />
    </div>
  );
}

async function ProfileContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }

  return (
    <ProfileForm
      draftId={user.id}
      initial={{
        sex: user.sex,
        age: user.age,
        heightCm: user.heightCm,
        activityLevel: user.activityLevel,
        experienceLevel: user.experienceLevel,
        primaryGoal: user.primaryGoal,
        primaryGoals: user.primaryGoals,
        trainingDaysPerWeek: user.trainingDaysPerWeek,
        primaryGoalDetail: user.primaryGoalDetail,
        trainingDescription: user.trainingDescription,
      }}
      weightUnit={user.weightUnit}
    />
  );
}
