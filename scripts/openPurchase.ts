import type { Router } from "expo-router";

// What the purchase sheet sells: one album, everything the artist sells, or support
// (a one-time tip or a subscription tier). `artist` is the artist's route id, the same
// id the album and artist pages use
export type PurchaseTarget =
  | { kind: "album"; artist: string; slug: string }
  | { kind: "catalogue"; artist: string }
  | { kind: "support"; artist: string; slug?: string };

export function openPurchase(router: Router, target: PurchaseTarget) {
  const params: Record<string, string> = {
    kind: target.kind,
    artist: target.artist,
    slug: "slug" in target && target.slug ? target.slug : "",
  };
  router.navigate({ pathname: "/purchaseModal", params });
}
