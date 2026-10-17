import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/state/AuthContext";
import { AUTH_PROFILE_QUERY_KEY } from "@/queries/authQueries";
import { queryUserCollection, queryUserPurchases } from "@/queries/queries";
import {
  checkoutCompleteUrl,
  latestTransactionId,
  startCheckout,
  type DeferredQuote,
  type PurchaseItem,
} from "@/queries/listener";

const POLL_MS = 3000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

export type CheckoutRequest = {
  artistId: number;
  artistSlug: string;
  items: PurchaseItem[];
  // Typed by a listener who isn't signed in; signed-in listeners pay with their account email
  guestEmail?: string;
};

// What each view of the sheet needs to start a checkout
export type CheckoutControls = {
  onPay: (request: CheckoutRequest) => void;
  busy: boolean;
  error?: string;
};

// The pay stage shows Mirlo's checkout: in-app Stripe Elements or hosted fallback
export type PayStageProps = {
  checkoutUrl?: string;
  deferred?: DeferredQuote;
  guestEmail?: string;
  onPaid: () => void;
  onCancel: () => void;
};

// recorded: Mirlo has the purchase. emailed: a guest paid and Mirlo emails them.
// processing: the payment went through and Mirlo hasn't recorded it yet
export type CheckoutOutcome = "recorded" | "emailed" | "processing";

export type CheckoutStage =
  | { name: "choose" }
  | { name: "pay"; checkoutUrl?: string; deferred?: DeferredQuote }
  | { name: "confirming" }
  | { name: "done"; outcome: CheckoutOutcome };

// Runs one purchase through Mirlo's hosted checkout: choose -> pay -> confirming -> done.
// Stripe tells Mirlo about a payment a moment after it goes through, so the purchase counts as
// recorded once the listener's newest transaction differs from the one before checkout
export function useCheckout() {
  const { user } = useAuthContext();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<CheckoutStage>({ name: "choose" });
  const [request, setRequest] = useState<CheckoutRequest>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const previousTransaction = useRef<string | undefined>(undefined);

  const finish = useCallback(async () => {
    if (userId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: queryUserCollection(userId).queryKey }),
        queryClient.invalidateQueries({ queryKey: queryUserPurchases(userId).queryKey }),
      ]);
    }
    setStage({ name: "done", outcome: "recorded" });
  }, [queryClient, userId]);

  const isRecorded = useCallback(
    async () =>
      Boolean(userId) &&
      (await latestTransactionId(userId!)) !== previousTransaction.current,
    [userId],
  );

  // Mirlo adds a free album on the spot, with no checkout page to open or payment to watch
  const pay = async (next: CheckoutRequest) => {
    const free = next.items.every((item) => "price" in item && item.price === "0");
    setBusy(true);
    setError(undefined);
    setRequest(next);
    try {
      previousTransaction.current =
        userId && !free ? await latestTransactionId(userId) : undefined;
      const { checkoutUrl, deferred } = await startCheckout({
        artistId: next.artistId,
        items: next.items,
        email: user?.email ?? next.guestEmail,
        successUrl: checkoutCompleteUrl(next.artistSlug, next.items[0].type),
      });
      if (deferred) {
        setStage({ name: "pay", deferred });
      } else if (checkoutUrl) {
        setStage({ name: "pay", checkoutUrl });
      } else {
        await finish();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the checkout. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // The listener has paid. Guests have no account to watch; Mirlo emails them
  const confirm = useCallback(() => {
    setStage(userId ? { name: "confirming" } : { name: "done", outcome: "emailed" });
  }, [userId]);

  const cancel = useCallback(() => setStage({ name: "choose" }), []);

  // Confirming: check every few seconds until Mirlo records the purchase or time runs out
  useEffect(() => {
    if (stage.name !== "confirming") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const startedAt = Date.now();
    const check = async () => {
      const recorded = await isRecorded().catch(() => false);
      if (!active) return;
      if (recorded) {
        await finish();
      } else if (Date.now() - startedAt >= POLL_LIMIT_MS) {
        setStage({ name: "done", outcome: "processing" });
      } else {
        timer = setTimeout(check, POLL_MS);
      }
    };
    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [stage.name, isRecorded, finish]);

  // Paying in another browser tab: check again whenever the listener comes back to this one
  useEffect(() => {
    if (stage.name !== "pay" || Platform.OS !== "web" || !userId) return;
    const onFocus = () => {
      isRecorded()
        .then((recorded) => (recorded ? finish() : undefined))
        .catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [stage.name, userId, isRecorded, finish]);

  return { stage, request, busy, error, pay, confirm, cancel };
}
