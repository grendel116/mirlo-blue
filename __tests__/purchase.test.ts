import {
  albumCurrency,
  checkAmount,
  defaultAlbumPrice,
  externalPurchaseLinks,
  formatPurchaseButtonLabel,
  intervalLabel,
  isEmail,
  isFreeAlbum,
  paidTiers,
  priceChips,
  sellsOnMirlo,
  tierAmount,
  toAmountText,
} from "@/components/purchase/helpers";

// The listener queries load the native cookie module; jest hoists this above the imports
jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: { get: jest.fn(), getAll: jest.fn(), clearAll: jest.fn() },
}));

const tier = (overrides: Partial<SubscriptionTier>): SubscriptionTier => ({
  id: 1,
  name: "Tier",
  artistId: 9,
  isDefaultTier: false,
  ...overrides,
});

describe("sellsOnMirlo", () => {
  test("Mirlo releases check out on Mirlo; other sources sell elsewhere", () => {
    expect(sellsOnMirlo({ source: "Mirlo Space" })).toBe(true);
    expect(sellsOnMirlo({ source: "Faircamp" })).toBe(false);
    expect(sellsOnMirlo({ source: "example.org" })).toBe(false);
    expect(sellsOnMirlo({})).toBe(false);
  });
});

describe("album prices", () => {
  test("a release with no minimum is free", () => {
    expect(isFreeAlbum({ minPrice: 0 })).toBe(true);
    expect(isFreeAlbum({ minPrice: null })).toBe(true);
    expect(isFreeAlbum({ minPrice: 500 })).toBe(false);
  });

  test("starts on the suggested price, else the minimum", () => {
    expect(defaultAlbumPrice({ minPrice: 500, suggestedPrice: 800 })).toBe(800);
    expect(defaultAlbumPrice({ minPrice: 500, suggestedPrice: null })).toBe(500);
    expect(defaultAlbumPrice({})).toBe(0);
  });

  test("uses the album's currency, else the artist's, else dollars", () => {
    expect(albumCurrency({ currency: "eur" }, { user: { currency: "gbp" } })).toBe("eur");
    expect(albumCurrency({}, { user: { currency: "gbp" } })).toBe("gbp");
    expect(albumCurrency({})).toBe("usd");
  });

  test("shows cents as major units", () => {
    expect(toAmountText(450)).toBe("4.50");
    expect(toAmountText(1000)).toBe("10.00");
  });
});

describe("priceChips", () => {
  test("offers the minimum, the suggestion and double the suggestion", () => {
    expect(priceChips(500, 800)).toEqual([
      { label: "Minimum", cents: 500 },
      { label: "Suggested", cents: 800 },
      { label: "Double", cents: 1600 },
    ]);
  });

  test("lists each amount once and doubles the minimum without a suggestion", () => {
    expect(priceChips(500, 500)).toEqual([
      { label: "Minimum", cents: 500 },
      { label: "Double", cents: 1000 },
    ]);
    expect(priceChips(500)).toEqual([
      { label: "Minimum", cents: 500 },
      { label: "Double", cents: 1000 },
    ]);
  });
});

describe("checkAmount", () => {
  test("reads major units into cents", () => {
    expect(checkAmount("4.50", 0, "usd")).toEqual({ cents: 450 });
    expect(checkAmount(" 4,50 ", 0, "usd")).toEqual({ cents: 450 });
  });

  test("asks for an amount when the field is empty, zero or not a number", () => {
    expect(checkAmount("", 0, "usd").error).toBe("Enter an amount");
    expect(checkAmount("0", 0, "usd").error).toBe("Enter an amount");
    expect(checkAmount("abc", 0, "usd").error).toBe("Enter an amount");
  });

  test("holds the amount to the minimum", () => {
    expect(checkAmount("4.99", 500, "usd").error).toMatch(/minimum is .*5\.00/);
    expect(checkAmount("5", 500, "usd")).toEqual({ cents: 500 });
  });
});

describe("isEmail", () => {
  test("accepts addresses and rejects other text", () => {
    expect(isEmail("listener@example.com")).toBe(true);
    expect(isEmail(" listener@example.com ")).toBe(true);
    expect(isEmail("listener@example")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("subscription tiers", () => {
  test("lists the paid tiers, leaving out the free follow tier", () => {
    const follow = tier({ id: 1, isDefaultTier: true });
    const paid = tier({ id: 2 });
    expect(paidTiers({ subscriptionTiers: [follow, paid] })).toEqual([paid]);
    expect(paidTiers(undefined)).toEqual([]);
  });

  test("charges the default amount, else the minimum", () => {
    expect(tierAmount({ defaultAmount: 700, minAmount: 500 })).toBe(700);
    expect(tierAmount({ defaultAmount: null, minAmount: 500 })).toBe(500);
    expect(tierAmount({})).toBe(0);
  });

  test("names the billing interval", () => {
    expect(intervalLabel("YEAR")).toBe("year");
    expect(intervalLabel("MONTH")).toBe("month");
    expect(intervalLabel(undefined)).toBe("month");
  });
});

describe("formatPurchaseButtonLabel", () => {
  test("formats store labels with 'Purchase on <Source>'", () => {
    expect(formatPurchaseButtonLabel("Bandcamp")).toBe("Purchase on Bandcamp");
    expect(formatPurchaseButtonLabel("Faircamp")).toBe("Purchase on Faircamp");
    expect(formatPurchaseButtonLabel("Buy on Bandcamp")).toBe("Purchase on Bandcamp");
  });

  test("formats Mirlo store labels with 'Purchase on Mirlo'", () => {
    expect(formatPurchaseButtonLabel("Mirlo")).toBe("Purchase on Mirlo");
    expect(formatPurchaseButtonLabel("mirlo space")).toBe("Purchase on Mirlo");
  });

  test("formats subscriptions cleanly", () => {
    expect(formatPurchaseButtonLabel("Mirlo Subscription")).toBe("Subscribe on Mirlo");
    expect(formatPurchaseButtonLabel("Subscribe on Mirlo")).toBe("Subscribe on Mirlo");
    expect(formatPurchaseButtonLabel("Subscription")).toBe("Subscribe on Mirlo");
    expect(formatPurchaseButtonLabel("Subscription", "Bandcamp")).toBe("Subscribe on Bandcamp");
  });

  test("normalizes generic 'Album' and 'Release' labels to the source", () => {
    expect(formatPurchaseButtonLabel("Buy Album")).toBe("Purchase on Mirlo");
    expect(formatPurchaseButtonLabel("Purchase Album")).toBe("Purchase on Mirlo");
    expect(formatPurchaseButtonLabel("Purchase Album", "Faircamp")).toBe("Purchase on Faircamp");
  });

  test("preserves custom support directives", () => {
    expect(formatPurchaseButtonLabel("Support Artist")).toBe("Support Artist");
  });

  test("uses 'Purchase on <fallbackSource>' when the label is missing", () => {
    expect(formatPurchaseButtonLabel(undefined)).toBe("Purchase on Mirlo");
    expect(formatPurchaseButtonLabel("")).toBe("Purchase on Mirlo");
    expect(formatPurchaseButtonLabel(undefined, "Faircamp")).toBe("Purchase on Faircamp");
  });
});

describe("externalPurchaseLinks", () => {
  test("labels every purchase link the release lists", () => {
    expect(
      externalPurchaseLinks({
        source: "Faircamp",
        sourceUrl: "https://artist.example",
        purchaseLinks: [
          { label: "Buy Album", url: "https://artist.example/buy" },
          { label: "Bandcamp", url: "https://artist.bandcamp.com" },
        ],
      }),
    ).toEqual([
      { label: "Purchase on Faircamp", url: "https://artist.example/buy" },
      { label: "Purchase on Bandcamp", url: "https://artist.bandcamp.com" },
    ]);
  });

  test("links the page the release came from when it lists no store", () => {
    expect(
      externalPurchaseLinks({ source: "Faircamp", sourceUrl: "https://artist.example" }),
    ).toEqual([{ label: "Purchase on Faircamp", url: "https://artist.example" }]);
    expect(externalPurchaseLinks({ sourceUrl: "https://artist.example" })).toEqual([
      { label: "Purchase on the artist's site", url: "https://artist.example" },
    ]);
  });

  test("has nothing to offer without links or a source page", () => {
    expect(externalPurchaseLinks({ source: "Faircamp" })).toEqual([]);
  });
});
