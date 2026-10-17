// Turns an artist's links into labelled icon chips. Recognises the sites Mirlo recognises
// (client/src/utils/links.ts in funmusicplace/mirlo) plus a few tip jars and music stores.
// Icons are FontAwesome6 glyph names; `brand` picks the brands font

export type ArtistLinkChip = {
  url: string;
  label: string;
  icon: string;
  brand: boolean;
  // The artist's own icon image, shown in place of the glyph
  iconUrl?: string;
};

type Site = {
  name: string;
  icon: string;
  brand: boolean;
  hosts: string[];
};

const SITES: Site[] = [
  { name: "Twitter", icon: "twitter", brand: true, hosts: ["twitter.com"] },
  { name: "X", icon: "x-twitter", brand: true, hosts: ["x.com"] },
  { name: "Facebook", icon: "facebook", brand: true, hosts: ["facebook.com", "fb.com"] },
  { name: "Bandcamp", icon: "bandcamp", brand: true, hosts: ["bandcamp.com"] },
  { name: "Instagram", icon: "instagram", brand: true, hosts: ["instagram.com"] },
  { name: "SoundCloud", icon: "soundcloud", brand: true, hosts: ["soundcloud.com"] },
  { name: "itch.io", icon: "itch-io", brand: true, hosts: ["itch.io"] },
  { name: "Discord", icon: "discord", brand: true, hosts: ["discord.com", "discord.gg"] },
  { name: "Bluesky", icon: "bluesky", brand: true, hosts: ["bsky.app"] },
  { name: "YouTube", icon: "youtube", brand: true, hosts: ["youtube.com", "youtu.be"] },
  { name: "Patreon", icon: "patreon", brand: true, hosts: ["patreon.com"] },
  { name: "Twitch", icon: "twitch", brand: true, hosts: ["twitch.tv"] },
  { name: "TikTok", icon: "tiktok", brand: true, hosts: ["tiktok.com"] },
  { name: "Spotify", icon: "spotify", brand: true, hosts: ["spotify.com"] },
  { name: "Deezer", icon: "deezer", brand: true, hosts: ["deezer.com"] },
  { name: "Mirlo", icon: "crow", brand: false, hosts: ["mirlo.space"] },
  { name: "Apple Music", icon: "apple", brand: true, hosts: ["music.apple.com"] },
  { name: "Tidal", icon: "music", brand: false, hosts: ["tidal.com"] },
  { name: "Buy Me a Coffee", icon: "mug-hot", brand: false, hosts: ["buymeacoffee.com"] },
  { name: "Ko-fi", icon: "mug-saucer", brand: false, hosts: ["ko-fi.com"] },
  { name: "Liberapay", icon: "hand-holding-heart", brand: false, hosts: ["liberapay.com"] },
  { name: "Linktree", icon: "tree", brand: false, hosts: ["linktr.ee"] },
];

// Federated sites run on many servers, so they're known by a host prefix or a /@user path
const PEERTUBE: Site = { name: "PeerTube", icon: "circle-play", brand: false, hosts: [] };
const MASTODON: Site = { name: "Mastodon", icon: "mastodon", brand: true, hosts: [] };
const EMAIL: Site = { name: "Email", icon: "envelope", brand: false, hosts: [] };
const WEBSITE = { icon: "globe", brand: false };

const KNOWN_TYPES = [...SITES, PEERTUBE, MASTODON, EMAIL];

const typeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const EMAIL_ADDRESS = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/;

// A full URL: mailto: for addresses, https:// added when the scheme is missing, and http
// moved to https since the in-app browser opens https pages
function normaliseUrl(raw: string): URL | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const withScheme = EMAIL_ADDRESS.test(value)
    ? `mailto:${value}`
    : /^[a-z][a-z0-9+.-]*:/i.test(value)
      ? value.replace(/^http:/i, "https:")
      : `https://${value}`;
  try {
    return new URL(withScheme);
  } catch {
    return undefined;
  }
}

const onHost = (hostname: string, host: string) =>
  hostname === host || hostname.endsWith(`.${host}`);

function detectSite(url: URL): Site | undefined {
  if (url.protocol === "mailto:") return EMAIL;
  const hostname = url.hostname.toLowerCase();
  const site = SITES.find((s) => s.hosts.some((host) => onHost(hostname, host)));
  if (site) return site;
  if (hostname.startsWith("peertube.")) return PEERTUBE;
  if (hostname.startsWith("mastodon.") || /^\/@[^/]+/.test(url.pathname)) return MASTODON;
  return undefined;
}

// "www.mowukis.com" -> "Mowukis", "band.co.uk" -> "Band"
function domainLabel(hostname: string): string {
  const parts = hostname.replace(/^www\./i, "").split(".");
  const n = parts.length;
  const name =
    n > 2 && parts[n - 1].length === 2 && parts[n - 2].length <= 3
      ? parts[n - 3]
      : parts[Math.max(0, n - 2)];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toChip(link: ArtistLink): ArtistLinkChip | undefined {
  const url = normaliseUrl(link.url ?? "");
  if (!url) return undefined;
  const linkType = link.linkType?.trim() ?? "";
  const typed = linkType
    ? KNOWN_TYPES.find((s) => typeKey(s.name) === typeKey(linkType))
    : undefined;
  const detected = detectSite(url);
  const iconUrl = !typed && link.iconUrl ? link.iconUrl : undefined;
  const icon = typed ?? detected ?? WEBSITE;
  return {
    url: url.href,
    label:
      link.linkLabel?.trim() ||
      linkType ||
      detected?.name ||
      (url.protocol === "mailto:" ? EMAIL.name : domainLabel(url.hostname)),
    icon: icon.icon,
    brand: icon.brand,
    ...(iconUrl ? { iconUrl } : {}),
  };
}

const sameUrlKey = (href: string) => href.toLowerCase().replace(/\/+$/, "");

// The artist's links in the order they set them, legacy plain links after, each URL once
export function artistLinks(
  artist: Pick<Artist, "linksJson" | "links">,
): ArtistLinkChip[] {
  const all: ArtistLink[] = [
    ...(artist.linksJson ?? []),
    ...(artist.links ?? []).map((url) => ({ url })),
  ];
  const seen = new Set<string>();
  const chips: ArtistLinkChip[] = [];
  for (const link of all) {
    const chip = toChip(link);
    if (!chip || seen.has(sameUrlKey(chip.url))) continue;
    seen.add(sameUrlKey(chip.url));
    chips.push(chip);
  }
  return chips;
}
