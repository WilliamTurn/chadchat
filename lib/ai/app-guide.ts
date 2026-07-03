/**
 * The app guide (HLP-3): one detailed "Chad app — features, plans, how-to"
 * document, written for retrieval. Chad's getAppGuide tool (CHT-9) serves it
 * so he can answer "how does X work in the app?" from facts instead of
 * guessing, without this text bloating his system prompt.
 *
 * KEEP IN SYNC with the member-facing help center (`app/help/page.tsx`) and
 * the pricing page: both describe the same product, and drift between them is
 * exactly the class of bug the help rebuild (LC-8) fixed. Feature names must
 * match the navigation exactly.
 *
 * Everything here is member-facing knowledge. No internal implementation
 * detail (model names, table names, env vars) belongs in this file.
 */

export type AppGuideSection = {
  /** Stable id the tool's topic filter uses. */
  id: string;
  title: string;
  content: string;
};

export const APP_GUIDE_SECTIONS: AppGuideSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    content: `New members go through a short welcome wizard, then land in chat with Chad. The loop: (1) tell Chad your goal, training history, injuries, equipment, and schedule in chat; he remembers it, so you say it once. (2) Set a goal, in chat or on the Goals page; Chad turns it into a written plan with a target and a pace. (3) Log as you go: workouts after training, meals when you eat (a photo is enough), a morning weigh-in, water and sleep whenever. (4) Check the Dashboard and take the review; Chad sees everything you log and coaches from it.`,
  },
  {
    id: "chat",
    title: "Chat (talking to Chad)",
    content: `Chat is the home page. Chad remembers what members tell him between chats (memory can be turned off in Settings, in the menu under their name in the chat sidebar). He can read their logged data for any day, including past days, and he can log FOR them in chat: workouts, meals, water, sleep, and weigh-ins, plus update their profile stats when they settle on a change. Members can attach photos (Pro and up): a meal to analyze, a nutrition label to read, a physique check-in. The Share button in a chat's header creates a public read-only link to that conversation; chats are private unless the member makes one, and a link can be revoked anytime. New chats start from the sidebar's "New chat"; past chats are listed there too.`,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: `The Dashboard (the "Dashboard" nav item) is home base: today's calories and macros vs targets, weight trend, streak, last workout, water, sleep, goals, and the active meal plan, each as a card. Every card links to its full page, and the "Ask Chad" buttons open a chat about that exact card. The streak counts days where anything at all was logged: a meal, a workout, a weigh-in, water, or sleep. Weekly stats and 7-day strips run Sunday through Saturday in the member's own time zone.`,
  },
  {
    id: "workouts",
    title: "Workouts (Pro feature)",
    content: `Log every session: exercises, sets, reps, weight, and RPE, with set types and session notes. The page tracks total volume, personal records, and estimated one-rep max per lift with trend charts. If Chad wrote the member a training plan, it shows as day cards on this page; pressing Start opens the logger pre-filled with that day's planned exercises and targets, with last session's numbers as one-tap ghosts. Built-in tools: a rest timer (presets or a custom duration), a plate calculator (including custom bar weights), and custom exercises (create, edit, delete; weighted, bodyweight, or timed). Chad sees every logged workout and holds the member to the plan.`,
  },
  {
    id: "calorie-tracker",
    title: "Calorie Tracker (Pro feature)",
    content: `Six ways to log food: search the verified food database by name and set the portion (grams, ounces, or servings); scan a packaged food's barcode with the camera; photograph the meal and Chad identifies it and estimates macros; photograph the nutrition label and Chad reads the printed numbers; enter macros manually; or re-log a recent meal in one tap. Macro numbers come from verified food databases (USDA and Open Food Facts), not from guessing. Meals Chad analyzes get graded against the member's targets with a verdict. The page tracks calories, protein, carbs, and fat against daily targets, with history and trend charts. Logged meals can be edited or deleted (delete offers an Undo). Daily targets are set on the Dashboard or the Calorie Tracker, or the member can ask Chad to set them.`,
  },
  {
    id: "meal-plan",
    title: "Meal Plan (Pro feature)",
    content: `Ask Chad for a meal plan in chat and he builds a structured plan of real meals that hits the member's calorie and macro targets: every ingredient with gram amounts and its own macros, per-meal and per-day totals. Portions are adjustable and the numbers recalculate instantly. "Log as eaten" logs a plan meal into the Calorie Tracker in one tap with exact macros. The plan downloads as a PDF. The active plan lives on the Meal Plan page and Chad references it when reviewing what the member ate.`,
  },
  {
    id: "rate-my-kitchen",
    title: "Rate My Kitchen (Pro feature)",
    content: `Photograph a fridge, a pantry, or ANY food-related scene (there's an "Other" option: grocery cart, market haul, hotel minibar, buffet, cooler) and Chad rates whatever he is shown: what supports the goal, what sabotages it, and what to pick instead. Good before a grocery run or when deciding what to eat away from home. An optional note field adds context Chad reads. Past kitchen shots are kept on the page.`,
  },
  {
    id: "progress",
    title: "Progress (Pro feature)",
    content: `Log weigh-ins, progress photos, and body measurements (waist, hips, arms, chest, and more) over time. The weight chart shows raw weigh-ins plus a smoothed TREND WEIGHT; the trend filters out daily water and food-timing noise and is the number the app uses for goal progress, so members are judged on the trend line, not one bad morning. The chart also projects when the member reaches their goal weight at the current pace. Progress photos can be compared side by side across dates.`,
  },
  {
    id: "goals",
    title: "Goals",
    content: `Members set goals in chat or on the Goals page: lose weight, build muscle, or hit a lift (a target estimated 1RM on a named exercise, tracked from logged sets). Chad writes each goal up properly: the target, the pace, and the plan behind it. Goal progress shows on the Dashboard and the Goals page, Chad brings goals up in chat, and goals and training plans download as PDFs. Past (completed or replaced) goals stay listed on the Goals page.`,
  },
  {
    id: "hydration",
    title: "Hydration (Pro feature)",
    content: `Log water through the day in ounces: quick-add +8 oz or +16 oz, or a custom amount. The daily target defaults to 1 gallon (128 oz) and is customizable on the card. The Dashboard card shows progress and what's left; the Hydration page has the full trend chart and an itemized log of today's entries (each deletable), plus an "Undo last add" for mis-taps. Chad sees water in his review of the day.`,
  },
  {
    id: "sleep",
    title: "Sleep (Pro feature)",
    content: `Log how long you slept and rate the night 1 to 5. One entry per night; re-logging the same night overwrites it. The page charts hours against the recommended 7 hours, sleep counts toward the streak, and Chad factors it into coaching.`,
  },
  {
    id: "weekly-report",
    title: "Weekly Report (Elite feature)",
    content: `Every week Chad writes a full coach's report from the member's real logs: what they trained, how they ate, where the weight is heading, and exactly what changes next week, with reasons. It is emailed and saved on the Weekly Report page, and each report downloads as a PDF. Elite members pick the day and time it lands on the Account page.`,
  },
  {
    id: "check-ins",
    title: "Check-ins (Elite feature)",
    content: `Chad reaches out first by email instead of waiting: morning briefs, missed-workout callouts, weigh-in nudges. The frequency is the member's choice, set on the Account page.`,
  },
  {
    id: "plans-billing",
    title: "Plans and billing",
    content: `Three plans, monthly: Chad Basic at $29/month (chat with Chad anytime: personalized workout and nutrition guidance, goals and training plans, full coaching history). Chad Pro at $39/month (everything in Basic plus the full dashboard: Workouts, Calorie Tracker with photo and label analysis, Meal Plan, Rate My Kitchen, Progress, Hydration, Sleep). Chad Elite at $59/month (everything in Pro, plus Chad comes to you: proactive Check-ins, the Weekly Report, and new features ship to Elite first). New members start with a 3-day free trial (card up front; it converts to the chosen plan after the trial). Billing lives on the Account page under "Manage billing": see the current plan and renewal date, update the card, move between Basic, Pro, and Elite, or cancel. Upgrades also work from the Pricing page (/pricing). Payments are handled by Stripe; canceling keeps access through the end of the paid period.`,
  },
  {
    id: "account",
    title: "Account page",
    content: `The Account page holds: the member's profile stats (primary goal, age, height, sex, training experience, training days per week; these feed Chad's coaching and can be edited anytime), Preferences including the time zone (detected from the browser, correctable there; the time zone decides when "today" rolls over for streaks and logs), sound effects and vibration switches for logging feedback (the success chime and phone buzz; Chad can flip these too when asked), email settings (Elite: Weekly Report day/time and Check-in frequency), billing ("Manage billing"), and CSV export of weigh-ins, meals, and workouts. Memory settings (turn Chad's memory off, or wipe it) are in Settings, in the menu under the member's name in the chat sidebar.`,
  },
  {
    id: "data-privacy",
    title: "Data and privacy",
    content: `The member's logged data is theirs: CSV export of weigh-ins, meals, and workouts from the Account page anytime. What Chad remembers from chats is used only for coaching; memory can be switched off or wiped in Settings (menu under the member's name in the chat sidebar). Conversations are private unless the member creates a share link, and a share link can be revoked anytime. Payments are handled by Stripe; the app never sees the card.`,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    content: `Emails not arriving: they come from noreply@send.chadcoach.ai; check spam and mark "Not spam". Photo upload fails: retry once (mobile connections drop mid-upload), then try a smaller photo; photo features need Pro or Elite. Day rolls over at the wrong time or dates look off: fix the time zone on the Account page under Preferences. Chad has a fact wrong: tell him directly in chat and he updates what he remembers; height/age/stats are edited on the Account page. Password reset: "Forgot password" on the login page emails a reset link. The small "?" icons next to stats around the dashboard explain what each number means.`,
  },
];

/** The topic ids the getAppGuide tool accepts. */
export const APP_GUIDE_TOPIC_IDS = APP_GUIDE_SECTIONS.map((s) => s.id);

/**
 * Render the guide (or a subset of topics) as plain text for a tool result.
 * Unknown ids are ignored; no matches (or no filter) returns the full guide,
 * so a mis-picked topic can never come back empty-handed.
 */
export function formatAppGuide(topics?: string[] | null): string {
  const wanted =
    topics && topics.length > 0
      ? APP_GUIDE_SECTIONS.filter((s) => topics.includes(s.id))
      : [];
  const sections = wanted.length > 0 ? wanted : APP_GUIDE_SECTIONS;
  return sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n");
}
