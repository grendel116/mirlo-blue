import { parseFaircampPageDetails, parseFaircampShopPage } from "@/queries/fairplayer";

// Markup shaped like Faircamp's renderer output (renderer/src/pages/multitrack_*.rs)
const releasePage = (actions: string, trailing = "") => `<html><body>
  <a href="cover_480.jpg?x"></a><a href="1/">Track</a>
  <div class="action_buttons">${actions}</div>${trailing}</body></html>`;

describe("Faircamp download button", () => {
  test("finds a German purchase page by shape, not by name", () => {
    const html = releasePage(`<a href="bezahlen/AbCdEfGhI_k/"><svg><title>Kaufen</title></svg><span>Herunterladen</span></a>`);
    expect(parseFaircampPageDetails(html, "https://example.org/album/").downloadAccess).toEqual({
      kind: "page",
      url: "https://example.org/album/bezahlen/AbCdEfGhI_k/",
    });
  });

  test("finds pages on sites without clean urls", () => {
    const html = releasePage(`<a href="downloads/AbCdEfGhI-k/index.html"><span>Download</span></a>`);
    expect(parseFaircampPageDetails(html, "https://example.org/album/").downloadAccess).toEqual({
      kind: "page",
      url: "https://example.org/album/downloads/AbCdEfGhI-k/index.html",
    });
  });

  test("reads external stores", () => {
    const html = releasePage(
      `<a href="#external_downloads"><span>Download</span></a>`,
      `<div class="external_downloads" id="external_downloads"><div>
        <a class="button emphasized" href="https://artist.bandcamp.com/album/x" target="_blank"><svg><title>External link</title></svg><span>Bandcamp</span></a>
        <a class="button" href="#">Close</a></div></div>`,
    );
    expect(parseFaircampPageDetails(html, "https://example.org/album/").downloadAccess).toEqual({
      kind: "external",
      links: [{ label: "Bandcamp", url: "https://artist.bandcamp.com/album/x" }],
    });
  });

  test("has no button when downloads are off", () => {
    expect(parseFaircampPageDetails(releasePage(""), "https://example.org/album/").downloadAccess).toBeUndefined();
  });
});

describe("Faircamp download pages", () => {
  const purchasePage = (priceInput: string, priceDisplay: string) => `<html><body>
    <div id="confirm_price">
      <div class="interactive"><form action="../../downloads/HaShHaShHaS/">${priceInput}<button>Confirm</button></form></div>
      <div class="non_interactive"><div>${priceDisplay}</div><br></div>
    </div>
    <div class="payment"><div class="text"><p>Pay via <a href="https://ko-fi.com/x" target="_blank">ko-fi</a></p></div></div>
  </body></html>`;

  test("reads an open price", () => {
    const html = purchasePage(
      `<label for="price">Name your price</label><input data-min="5" id="price" type="text"> GBP`,
      "£ 5 or more GBP",
    );
    expect(parseFaircampShopPage(html, "https://example.org/album/purchase/PuRcHaSeHaS/")).toEqual({
      mode: "paycurtain",
      price: { currency: "GBP", minimum: 5, maximum: undefined },
      info: "Pay via [ko-fi](https://ko-fi.com/x)",
      downloadsUrl: "https://example.org/album/downloads/HaShHaShHaS/",
    });
  });

  test("reads a range", () => {
    const html = purchasePage(`<input data-max="20" data-min="4.5" id="price" type="text"> EUR`, "€ 4.5-20 EUR");
    expect(parseFaircampShopPage(html, "https://example.org/a/b/c/")).toMatchObject({
      price: { currency: "EUR", minimum: 4.5, maximum: 20 },
    });
  });

  test("reads a set price", () => {
    const html = purchasePage("Preis €7 EUR", "€ Preis €7 EUR EUR");
    expect(parseFaircampShopPage(html, "https://example.org/a/b/c/")).toMatchObject({
      price: { currency: "EUR", minimum: 7, maximum: 7 },
    });
  });

  test("reads an unlock page with a translated downloads name", () => {
    const html = `<html><body><div class="unlock_scripted"><p>Codes come with the vinyl.</p><br><br>
      <form id="unlock"><input class="download_code" type="text"><button name="unlock">Freischalten</button></form>
      <script>const url = \`../../downloads/\${code}/index.html\`;</script></div></body></html>`;
    expect(parseFaircampShopPage(html, "https://example.org/album/freischalten/UnLoCkHaShH/index.html")).toEqual({
      mode: "code",
      info: "Codes come with the vinyl.",
      codePrefix: "https://example.org/album/downloads/",
      codeSuffix: "/index.html",
    });
  });

  test("reads a free downloads page", () => {
    const html = `<div class="download_formats"><div class="download_entry">
      <a download href="../../mp3-v0/x/a.zip">MP3</a><span class="download_underline"></span><span>54MB</span></div></div>`;
    expect(parseFaircampShopPage(html, "https://example.org/album/downloads/FrEeHaShHaS/")).toEqual({
      mode: "free",
      downloadsUrl: "https://example.org/album/downloads/FrEeHaShHaS/",
    });
  });
});
