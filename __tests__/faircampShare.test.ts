import worker from "../worker/src/index";

const verifiedHub = `
  <a href="https://sockpuppet.band/music">
    <span class="bg-success"></span>
    <span>Faircamp</span>
  </a>
`;

const releasePage = `
  <div class="song" data-id="8153" data-title="La del cowboy" data-release="Primer calaix"
    data-duration="166" data-url="https://sockpuppet.band/audio/first.opus"
    data-image="https://images.example/cover.jpg"
    data-releaseUrl="/player/release/primer-calaix@sockpuppet.band"
    data-artist="Calaix desastre"></div>
`;

describe("Faircamp short share links", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test("renders Faircamp track metadata, correct artwork MIME, and a 10-second preview", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://images.example/cover.jpg") {
        return new Response(null, {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      }
      return new Response(
        url.endsWith("/hub/") ? verifiedHub : releasePage,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }) as typeof fetch;

    const response = await worker.fetch(
      new Request("https://share.example/t/f8153"),
      {},
      {},
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("La del cowboy");
    expect(html).toContain("Calaix desastre");
    expect(html).toContain("https://sockpuppet.band/audio/first.opus");
    expect(html).toContain(
      "https://share.example/image?url=https%3A%2F%2Fimages.example%2Fcover.jpg",
    );
    expect(html).toContain('og:image:type" content="image/webp"');
    expect(html).toContain("SAMPLE_LIMIT = 10");
    expect(html).toContain("Visit Faircamp Catalog");
    expect(html).toContain(
      "/artist/fairplayer/album/fairplayer-primer-calaix%40sockpuppet.band/album-tracks",
    );
  });

  test("does not create share previews for catalogs not verified by Fairplayer", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return new Response(
        url.endsWith("/hub/")
          ? '<a href="https://sockpuppet.band/music"><span>Faircamp</span></a>'
          : releasePage,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }) as typeof fetch;

    const response = await worker.fetch(
      new Request("https://share.example/t/f8153"),
      {},
      {},
    );

    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("resolves compact Mirlo track links without changing their numeric ID", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://mirlo.space/v1/tracks/34357");
      return Response.json({
        result: {
          title: "A Mirlo song",
          trackGroup: {
            artist: { name: "Mirlo Artist", urlSlug: "mirlo-artist" },
            title: "A Mirlo album",
            urlSlug: "mirlo-album",
            cover: { sizes: { 600: "https://images.example/mirlo.jpg" } },
          },
        },
      });
    }) as typeof fetch;

    const response = await worker.fetch(
      new Request("https://share.example/t/34357"),
      {},
      {},
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("A Mirlo song");
    expect(html).toContain("Mirlo Artist");
    expect(html).toContain("https://mirlo.space/v1/tracks/34357/stream/playlist.m3u8");
  });
});
