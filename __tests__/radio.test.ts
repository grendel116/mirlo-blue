import {
  deduplicateRadioStations,
  fetchDiscoveredRadioStations,
  RADICAL_RADIO_TAGS,
  type RadioStation,
  radioBrowserToRadioStation,
} from "@/queries/radio";

describe("discovered radio stations", () => {
  test("removes duplicate stations by name, homepage, or stream while keeping the first entry", () => {
    const makeStation = (
      overrides: Partial<RadioStation>,
    ): RadioStation => ({
      id: "station",
      name: "Independent Radio",
      liveName: "Independent Radio",
      location: "Global",
      artwork: "https://example.com/art.jpg",
      about: "",
      streamUrl: "https://stream.example.com/live",
      playlistPage: "https://example.com/",
      donatePage: "https://example.com/",
      fetchPlays: async () => [],
      ...overrides,
    });

    const curated = makeStation({ id: "curated" });
    const duplicateByName = makeStation({
      id: "discovered-name",
      name: "Independent-Radio",
      streamUrl: "https://different.example.com/live",
      playlistPage: "https://different.example.com/",
    });
    const duplicateByHomepage = makeStation({
      id: "discovered-homepage",
      name: "Another Name",
      streamUrl: "https://different.example.com/other",
      playlistPage: "https://www.example.com",
    });
    const duplicateByStream = makeStation({
      id: "discovered-stream",
      name: "Third Name",
      streamUrl: "http://www.stream.example.com/live/",
      playlistPage: "https://third.example.com/",
    });
    const unique = makeStation({
      id: "unique",
      name: "Unique Station",
      streamUrl: "https://unique.example.com/live",
      playlistPage: "https://unique.example.com/",
    });
    const sameNameDifferentLocation = makeStation({
      id: "same-name-different-location",
      location: "Elsewhere",
      streamUrl: "https://elsewhere.example.com/live",
      playlistPage: "https://elsewhere.example.com/",
    });

    expect(
      deduplicateRadioStations([
        curated,
        duplicateByName,
        duplicateByHomepage,
        duplicateByStream,
        unique,
        sameNameDifferentLocation,
      ]),
    ).toEqual([curated, unique, sameNameDifferentLocation]);
  });

  test("uses the full Radio-Browser UUID for server-side short-link resolution", () => {
    const station = radioBrowserToRadioStation({
      stationuuid: "11111111-1111-1111-1111-111111111111",
      name: "Shortwave",
      url: "https://example.com/stream",
      favicon: "https://example.com/art.jpg",
    });

    expect(station.id).toBe("rb-11111111111111111111111111111111");
  });

  test("searches all discovery tags, prioritizes recent clicks, and requires quality artwork", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          stationuuid: "11111111-1111-1111-1111-111111111111",
          name: "Recently Clicked",
          url: "https://example.com/recent",
          favicon: "https://example.com/recent.jpg",
          clicktimestamp: "2026-10-14T12:00:00Z",
        },
        {
          stationuuid: "22222222-2222-2222-2222-222222222222",
          name: "Older Station",
          url: "https://example.com/older",
          favicon: "https://example.com/older.jpg",
          clicktimestamp: "2026-10-13T12:00:00Z",
        },
        {
          stationuuid: "33333333-3333-3333-3333-333333333333",
          name: "Without Artwork",
          url: "https://example.com/no-art",
          clicktimestamp: "2026-10-15T12:00:00Z",
        },
        {
          stationuuid: "44444444-4444-4444-4444-444444444444",
          name: "Favicon Artwork",
          url: "https://example.com/favicon-artwork",
          favicon: "https://example.com/favicon.ico",
        },
      ],
    } as Response);

    try {
      const stations = await fetchDiscoveredRadioStations();
      expect(fetchSpy).toHaveBeenCalledTimes(RADICAL_RADIO_TAGS.length);
      for (const [endpoint] of fetchSpy.mock.calls) {
        const url = new URL(String(endpoint));
        expect(url.searchParams.get("order")).toBe("clicktimestamp");
        expect(url.searchParams.get("reverse")).toBe("true");
        expect(url.searchParams.get("hidebroken")).toBe("true");
      }
      expect(stations.map((station) => station.name)).toEqual([
        "Recently Clicked",
        "Older Station",
      ]);
      expect(stations[0].artwork).toBe("https://example.com/recent.jpg");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
