jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: { get: jest.fn(), getAll: jest.fn(), clearAll: jest.fn() },
}));

import {
  artistRelation,
  followedArtists,
  formatMoney,
  isCheckoutCompleteUrl,
  toCents,
} from "@/queries/listener";

const artist = (id: number, name: string) => ({ id, name }) as Artist;

const subscription = (tier: Partial<SubscriptionTier>) =>
  ({ id: 1, amount: 0, userId: 9, artistSubscriptionTier: tier }) as ArtistUserSubscription;

const user = (subs: ArtistUserSubscription[]) =>
  ({ id: 9, artistUserSubscriptions: subs }) as LoggedInUser;

describe("artistRelation", () => {
  it("reads a free follow from the default tier", () => {
    const u = user([subscription({ artistId: 3, isDefaultTier: true, name: "Follow" })]);
    expect(artistRelation(u, 3)).toEqual({ isFollowing: true, subscriptionTier: undefined });
    expect(artistRelation(u, 4).isFollowing).toBe(false);
  });

  it("returns the paid tier for subscribers", () => {
    const tier = { artistId: 3, isDefaultTier: false, name: "Supporter" };
    const u = user([subscription(tier)]);
    expect(artistRelation(u, 3)).toEqual({ isFollowing: true, subscriptionTier: tier });
  });

  it("treats a signed-out listener as following nobody", () => {
    expect(artistRelation(null, 3).isFollowing).toBe(false);
  });
});

describe("followedArtists", () => {
  it("lists each artist once, subscribers first with their tier name", () => {
    const u = user([
      subscription({ artistId: 1, isDefaultTier: true, artist: artist(1, "A") }),
      subscription({ artistId: 2, isDefaultTier: true, artist: artist(2, "B") }),
      subscription({ artistId: 2, isDefaultTier: false, name: "Supporter", artist: artist(2, "B") }),
    ]);
    expect(followedArtists(u).map((f) => [f.artist.name, f.tierName])).toEqual([
      ["B", "Supporter"],
      ["A", undefined],
    ]);
  });
});

describe("money", () => {
  it("turns typed amounts into cents", () => {
    expect(toCents("4.5")).toBe(450);
    expect(toCents("4,50")).toBe(450);
    expect(toCents("10")).toBe(1000);
    expect(toCents("abc")).toBeNaN();
  });

  it("formats cents in the release currency", () => {
    expect(formatMoney(450, "usd")).toContain("4.50");
  });
});

describe("isCheckoutCompleteUrl", () => {
  it("matches Mirlo's checkout-complete page only", () => {
    expect(
      isCheckoutCompleteUrl("https://mirlo.space/mowukis/checkout-complete?purchaseType=tip"),
    ).toBe(true);
    expect(isCheckoutCompleteUrl("https://mirlo.space/checkout?checkoutId=1")).toBe(false);
    expect(isCheckoutCompleteUrl("https://evil.example/checkout-complete")).toBe(false);
  });
});
