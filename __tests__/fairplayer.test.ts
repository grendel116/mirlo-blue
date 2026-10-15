import {
  fetchFairplayerAlbums,
  fetchFairplayerSongReleaseSlug,
  fairplayerReleaseSlug,
  parseFairplayerRelease,
  parseFairplayerReleaseCards,
  parseFairplayerSearchResults,
  parseVerifiedFaircampCatalogs,
  searchFairplayerAlbums,
} from "@/queries/fairplayer";

describe("Fairplayer Faircamp catalog integration", () => {
  test("resolves Fairplayer song IDs to their Faircamp album slug", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () =>
          Promise.resolve(`
            <div class="song" data-id="8153"
              data-releaseUrl="/player/release/primer-calaix@sockpuppet.band">
            </div>
          `),
      } as Response),
    );

    try {
      await expect(fetchFairplayerSongReleaseSlug("8153")).resolves.toBe(
        "fairplayer-primer-calaix%40sockpuppet.band",
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/fairplayer\/player\/song\/8153$/),
        expect.objectContaining({ headers: { Accept: "text/html" } }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("resolves synthetic Fairplayer track IDs without a song-page request", async () => {
    await expect(
      fetchFairplayerSongReleaseSlug("primer-calaix@sockpuppet.band#2"),
    ).resolves.toBe("fairplayer-primer-calaix%40sockpuppet.band");
  });

  test("fetches the Fairplayer directory and filters it through verified hub catalogs", async () => {
    const originalFetch = global.fetch;
    const directory = `
      <a hx-get="/player/release/sjX@sockpuppet.band">
        <img src="https://images.example/sjx.jpg">
        <p title="sjX">sjX</p>
        <p>Sockpuppet</p>
      </a>
      <a hx-get="/player/release/other@not-verified.example">
        <img src="https://images.example/other.jpg">
        <p title="Other">Other</p>
        <p>Other Artist</p>
      </a>
    `;
    const hub = `
      <a href="https://sockpuppet.band/music">
        <span class="bg-success"></span>
        <span>Faircamp</span>
      </a>
    `;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/fairplayer/hub") ? hub : directory;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(body),
      } as Response);
    });

    try {
      const albums = await fetchFairplayerAlbums(10);

      expect(albums).toHaveLength(1);
      expect(albums[0].sourceUrl).toBe("https://sockpuppet.band/music");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("parses Fairplayer release IDs using their catalog host", () => {
    const albums = parseFairplayerReleaseCards(`
      <a hx-get="/player/release/sjX@sockpuppet.band">
        <img src="https://images.example/sjx.jpg">
        <p title="sjX">sjX</p>
        <p>Sockpuppet</p>
      </a>
      <a hx-get="/player/release/123@mirlo.space">
        <img src="https://images.example/mirlo.jpg">
        <p title="Mirlo album">Mirlo album</p>
        <p>Mirlo Artist</p>
      </a>
    `);

    expect(albums).toHaveLength(2);
    expect(albums[0].title).toBe("sjX");
    expect(albums[0].artist.name).toBe("Sockpuppet");
    expect(albums[0].source).toBe("Faircamp");
    expect(albums[0].sourceUrl).toBe("https://sockpuppet.band");
    expect(albums[0].urlSlug).toBe(
      fairplayerReleaseSlug.encode("sjX@sockpuppet.band"),
    );
  });

  test("reads verified Faircamp domains from catalog cards only", () => {
    const catalogs = parseVerifiedFaircampCatalogs(`
      <a href="https://sockpuppet.band/music">
        <span class="bg-success"></span>
        <span>Faircamp</span>
      </a>
      <a href="https://not-verified.example/music">
        <span>Faircamp</span>
      </a>
      <a href="https://mirlo.space">
        <span class="bg-success"></span>
        <span>Mirlo</span>
      </a>
    `);

    expect([...catalogs]).toEqual([
      ["sockpuppet.band", "https://sockpuppet.band/music"],
    ]);
  });

  test("parses album search results with host-based release IDs", () => {
    const albums = parseFairplayerSearchResults({
      items: [
        {
          type: "album",
          name: "sjX",
          url: "https://fairplayer.band/player/release/sjX@sockpuppet.band",
          artist: "Sockpuppet",
          images: { default: { src: "https://images.example/sjx.jpg" } },
        },
        {
          type: "album",
          name: "Mirlo album",
          url: "https://fairplayer.band/player/release/123@mirlo.space",
          artist: "Mirlo Artist",
        },
        {
          type: "track",
          name: "A track",
          url: "https://fairplayer.band/player/song/10",
          artist: "Sockpuppet",
        },
      ],
    });

    expect(albums).toHaveLength(2);
    expect(albums[0].title).toBe("sjX");
    expect(albums[0].cover.sizes[600]).toBe("https://images.example/sjx.jpg");
  });

  test("filters search results through verified Faircamp catalogs", async () => {
    const originalFetch = global.fetch;
    const hub = `
      <a href="https://sockpuppet.band/music">
        <span class="bg-success"></span>
        <span>Faircamp</span>
      </a>
    `;
    const searchResults = {
      items: [
        {
          type: "album",
          name: "sjX",
          url: "https://fairplayer.band/player/release/sjX@sockpuppet.band",
          artist: "Sockpuppet",
        },
        {
          type: "album",
          name: "Mirlo album",
          url: "https://fairplayer.band/player/release/123@mirlo.space",
          artist: "Mirlo Artist",
        },
      ],
    };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/fairplayer/hub")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(hub),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(searchResults),
      } as Response);
    });

    try {
      const albums = await searchFairplayerAlbums("sockpuppet");

      expect(albums).toHaveLength(1);
      expect(albums[0].title).toBe("sjX");
      expect(albums[0].sourceUrl).toBe("https://sockpuppet.band/music");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("converts release details to direct, unauthenticated Faircamp audio tracks", () => {
    const album = parseFairplayerRelease(
      `
        <h1>sjX</h1>
        <div class="song"
          data-id="10483"
          data-title="The War Machine"
          data-duration="252"
          data-url="https://sockpuppet.band/sjx/01-war-machine.opus"
          data-image="https://images.example/sjx.jpg"
          data-artist="Sockpuppet">
        </div>
      `,
      fairplayerReleaseSlug.encode("sjX@sockpuppet.band"),
    );

    expect(album.title).toBe("sjX");
    expect(album.about).toBe("");
    expect(album.artist.name).toBe("Sockpuppet");
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks?.[0].url).toBe(
      "https://sockpuppet.band/sjx/01-war-machine.opus",
    );
    expect(album.tracks?.[0].headers).toEqual({});
    expect(album.tracks?.[0].isPreview).toBe(true);
    expect(album.tracks?.[0].sourceUrl).toBe("https://sockpuppet.band");
  });

  test("reads the Faircamp release description for the About section", () => {
    const album = parseFairplayerRelease(
      `
        <h1>sjX</h1>
        <div class="text-low line-clamp-4 text-lg text-md:sm">
          <p>A release description with &amp; decoded text.</p>
        </div>
        <div class="song"
          data-id="10483"
          data-title="The War Machine"
          data-duration="252"
          data-url="https://sockpuppet.band/sjx/01-war-machine.opus"
          data-image="https://images.example/sjx.jpg"
          data-artist="Sockpuppet">
        </div>
      `,
      fairplayerReleaseSlug.encode("sjX@sockpuppet.band"),
    );

    expect(album.about).toBe("A release description with & decoded text.");
  });
});
