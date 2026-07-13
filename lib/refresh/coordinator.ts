/**
 * REFRESH COORDINATOR (FIX-10, P4 / DSH-66): the server-only half of the
 * mutation receipt. Applying a receipt revalidates every dependent surface
 * derived from the contract graph (lib/refresh/receipt.ts), so Today,
 * Progress, domain detail, goals, and reports reconcile after a mutation
 * without a manual reload.
 *
 * Coach needs no revalidation: the chat route reads the database live on
 * every message (app/(chat)/api/chat/route.ts builds its dashboard snapshot
 * per request), so it observes every applied mutation immediately.
 *
 * Call AFTER the DB write succeeds, from a server action:
 *
 *   const receipt = loggingReceipt({ domain: "hydration", entity: "waterLog", op: "create" });
 *   applyMutationReceipt(receipt);
 */

import "server-only";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/contracts/routes";
import { type MutationReceipt, surfacesForReceipt } from "./receipt";

/**
 * Revalidate every surface the receipt's domains render on. Returns the
 * receipt so actions can `return { ...state, receipt: applyMutationReceipt(r) }`
 * when a client consumes it.
 */
export function applyMutationReceipt(receipt: MutationReceipt): MutationReceipt {
  for (const routeId of surfacesForReceipt(receipt)) {
    const path = ROUTES[routeId].path;
    if (path.includes("[")) {
      // Dynamic route: revalidate every rendered instance of the page.
      revalidatePath(path, "page");
    } else {
      revalidatePath(path);
    }
  }
  return receipt;
}
