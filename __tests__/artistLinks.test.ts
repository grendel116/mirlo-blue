import { artistLinks } from "@/scripts/artistLinks";

const chip = (url: string, extra: Partial<ArtistLink> = {}) =>
  artistLinks({ linksJson: [{ url, ...extra }] })[0];

describe("artistLinks", () => {
  test("labels and icons a live Mirlo artist's links", () => {
    expect(
      artistLinks({
        linksJson: [
          { url: "https://www.youtube.com/mowukis", linkType: "YouTube", linkLabel: "" },
          { url: "https://mowukis.bandcamp.com/", linkType: "" },
          { url: "https://www.mowukis.com/", linkType: "MOWUKIS", linkLabel: "MOWUKIS" },
        ],
      }),
    ).toEqual([
      { url: "https://www.youtube.com/mowukis", label: "YouTube", icon: "youtube", brand: true },
      { url: "https://mowukis.bandcamp.com/", label: "Bandcamp", icon: "bandcamp", brand: true },
      { url: "https://www.mowukis.com/", label: "MOWUKIS", icon: "globe", brand: false },
    ]);
  });

  test("recognises the sites Mirlo recognises by host", () => {
    const cases: [string, string, string][] = [
      ["https://twitter.com/a", "Twitter", "twitter"],
      ["https://x.com/a", "X", "x-twitter"],
      ["https://fb.com/a", "Facebook", "facebook"],
      ["https://www.instagram.com/a", "Instagram", "instagram"],
      ["https://soundcloud.com/a", "SoundCloud", "soundcloud"],
      ["https://someone.itch.io", "itch.io", "itch-io"],
      ["https://discord.gg/abc", "Discord", "discord"],
      ["https://bsky.app/profile/a", "Bluesky", "bluesky"],
      ["https://youtu.be/abc", "YouTube", "youtube"],
      ["https://www.patreon.com/a", "Patreon", "patreon"],
      ["https://www.twitch.tv/a", "Twitch", "twitch"],
      ["https://www.tiktok.com/@a", "TikTok", "tiktok"],
      ["https://open.spotify.com/artist/1", "Spotify", "spotify"],
      ["https://www.deezer.com/artist/1", "Deezer", "deezer"],
      ["https://mirlo.space/a", "Mirlo", "crow"],
      ["https://peertube.example.org/a/b", "PeerTube", "circle-play"],
      ["https://mastodon.social/@a", "Mastodon", "mastodon"],
    ];
    for (const [url, label, icon] of cases) {
      expect(chip(url)).toMatchObject({ label, icon });
    }
  });

  test("recognises tip jars, music stores and Mastodon on any server", () => {
    expect(chip("https://buymeacoffee.com/a")).toMatchObject({ label: "Buy Me a Coffee", icon: "mug-hot", brand: false });
    expect(chip("https://ko-fi.com/a")).toMatchObject({ label: "Ko-fi", icon: "mug-saucer" });
    expect(chip("https://linktr.ee/a")).toMatchObject({ label: "Linktree", icon: "tree" });
    expect(chip("https://liberapay.com/a")).toMatchObject({ label: "Liberapay", icon: "hand-holding-heart" });
    expect(chip("https://music.apple.com/us/artist/1")).toMatchObject({ label: "Apple Music", icon: "apple", brand: true });
    expect(chip("https://tidal.com/browse/artist/1")).toMatchObject({ label: "Tidal", icon: "music" });
    expect(chip("https://social.coop/@someone")).toMatchObject({ label: "Mastodon", icon: "mastodon", brand: true });
  });

  test("matches the artist's link type before the host", () => {
    expect(chip("https://toot.example/u/a", { linkType: "Mastodon" })).toMatchObject({
      label: "Mastodon",
      icon: "mastodon",
    });
    expect(chip("https://example.com", { linkType: "Buy me a coffee" })).toMatchObject({
      label: "Buy me a coffee",
      icon: "mug-hot",
    });
  });

  test("shows the artist's own icon image when the type is not a known site", () => {
    expect(chip("https://example.com", { iconUrl: "https://cdn.example/icon.png" })).toMatchObject({
      icon: "globe",
      iconUrl: "https://cdn.example/icon.png",
    });
    expect(
      chip("https://youtube.com/a", { linkType: "YouTube", iconUrl: "https://cdn.example/icon.png" }),
    ).not.toHaveProperty("iconUrl");
  });

  test("turns email addresses into mailto links", () => {
    expect(chip("band@example.com")).toEqual({
      url: "mailto:band@example.com",
      label: "Email",
      icon: "envelope",
      brand: false,
    });
    expect(chip("mailto:band@example.com", { linkType: "Email" })).toMatchObject({
      url: "mailto:band@example.com",
      label: "Email",
    });
  });

  test("adds https to bare hosts and labels unknown sites by their domain", () => {
    expect(chip("mowukis.com")).toEqual({
      url: "https://mowukis.com/",
      label: "Mowukis",
      icon: "globe",
      brand: false,
    });
    expect(chip("http://www.band.co.uk/tour")).toMatchObject({
      url: "https://www.band.co.uk/tour",
      label: "Band",
    });
  });

  test("keeps legacy links after linksJson, each URL once", () => {
    expect(
      artistLinks({
        linksJson: [{ url: "https://mowukis.bandcamp.com/" }],
        links: ["https://mowukis.bandcamp.com", "https://ko-fi.com/mowukis", "", "not a url at all"],
      }).map((c) => c.url),
    ).toEqual([
      "https://mowukis.bandcamp.com/",
      "https://ko-fi.com/mowukis",
    ]);
  });
});
