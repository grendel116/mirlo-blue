import { parse } from "parse5";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { audioTrackType } from "@/scripts/utils";
import { SHARE_HUB_URL } from "@/queries/shareHub";

const FAIRPLAYER_ROOT = "https://fairplayer.band";
const FAIRPLAYER_ID_PREFIX = "fairplayer-";
const FAIRPLAYER_ARTIST_PREFIX = "fairplayer-artist-";

// Domains with expired/invalid TLS certificates, non-standard ports, insecure HTTP, or dead 404 audio streams
const BLOCKED_FAIRCAMP_DOMAINS = new Set<string>([
  "faircamp.txels.art",
  "txels.art",
  "music.strangetextures.com",
  "strangetextures.com",
  "faircamp.omar.apps.dj",
  "cult.kidlightbulbs.com",
  "sknot.fr",
  "amicpublic.remor.net",
  "carmevives.remor.net",
  "garrafa.remor.net",
  "maldol.remor.net",
  "sknam.nham.co.uk",
  "tallhouserecordingco.com",
]);

const quarantinedFaircampDomains = new Set<string>();

function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().trim().replace(/^www\./, "").replace(/\.$/, "");
}

function isIpOrLocalhost(domain: string): boolean {
  if (!domain || domain === "localhost" || domain.endsWith(".local") || domain.endsWith(".internal")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain) || domain.includes(":")) {
    return true;
  }
  return false;
}

export function isFaircampDomainBlocked(domainOrUrl?: string): boolean {
  if (!domainOrUrl) return true;
  let domain = domainOrUrl.trim();
  if (domain.includes("://")) {
    try {
      const parsed = new URL(domain);
      if (parsed.protocol !== "https:") return true;
      if (parsed.port && parsed.port !== "443") return true;
      if (parsed.username || parsed.password) return true;
      domain = parsed.hostname;
    } catch {
      return true;
    }
  }
  const normalized = normalizeDomain(domain);
  if (!normalized || !normalized.includes(".") || isIpOrLocalhost(normalized)) {
    return true;
  }
  if (BLOCKED_FAIRCAMP_DOMAINS.has(normalized) || quarantinedFaircampDomains.has(normalized)) {
    return true;
  }
  for (const blocked of BLOCKED_FAIRCAMP_DOMAINS) {
    if (normalized.endsWith(`.${blocked}`)) return true;
  }
  for (const quarantined of quarantinedFaircampDomains) {
    if (normalized.endsWith(`.${quarantined}`)) return true;
  }
  return false;
}

export function blockFaircampDomain(domainOrUrl?: string): void {
  if (!domainOrUrl) return;
  let domain = domainOrUrl.trim();
  if (domain.includes("://")) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      return;
    }
  }
  const normalized = normalizeDomain(domain);
  if (!normalized) return;
  quarantinedFaircampDomains.add(normalized);

  for (const [slug, album] of knownAlbumsBySlug.entries()) {
    const releaseId = decodeReleaseSlug(slug);
    const albumDomain = releaseId ? getFaircampDomain(releaseId) : undefined;
    if (!albumDomain || albumDomain === normalized || albumDomain.endsWith(`.${normalized}`)) {
      knownAlbumsBySlug.delete(slug);
      if (album.artistId) {
        knownArtistsById.delete(album.artistId);
      }
    }
  }
}

const knownAlbumsBySlug = new Map<string, AlbumProps>();
const knownArtistsById = new Map<number, { name: string; sourceUrl?: string }>();

export function isKnownFairplayerArtistId(artistId: number): boolean {
  return knownArtistsById.has(artistId);
}

function shuffleItems<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[];
  value?: string;
};

type FairplayerSearchItem = {
  type?: string;
  name?: string;
  url?: string;
  uid?: string;
  artist?: string;
  images?: {
    default?: {
      src?: string;
    };
  };
};

type FairplayerSearchResponse = {
  items?: FairplayerSearchItem[];
};

function htmlChildren(node: HtmlNode): HtmlNode[] {
  return node.childNodes || [];
}

function findElements(
  root: HtmlNode,
  predicate: (node: HtmlNode) => boolean,
): HtmlNode[] {
  const matches: HtmlNode[] = [];
  const visit = (node: HtmlNode) => {
    if (predicate(node)) matches.push(node);
    for (const child of htmlChildren(node)) visit(child);
  };
  visit(root);
  return matches;
}

function getAttribute(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

function getText(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value || "";
  return htmlChildren(node).map(getText).join("").replace(/\s+/g, " ").trim();
}

function hasClass(node: HtmlNode, className: string): boolean {
  return (getAttribute(node, "class") || "").split(/\s+/).includes(className);
}

function parseHtml(html: string): HtmlNode {
  return parse(html) as unknown as HtmlNode;
}

function getFaircampReleaseId(urlOrPath: string): string | undefined {
  if (!urlOrPath || !urlOrPath.includes("/player/release/")) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(urlOrPath, FAIRPLAYER_ROOT);
  } catch {
    return undefined;
  }

  if (parsed.origin !== FAIRPLAYER_ROOT) return undefined;
  const match = parsed.pathname.match(/^\/player\/release\/([^/]+)\/?$/);
  if (!match) return undefined;

  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }

  return getFaircampDomain(id) ? id : undefined;
}

function encodeReleaseSlug(releaseId: string): string {
  return `${FAIRPLAYER_ID_PREFIX}${encodeURIComponent(releaseId)}`;
}

function decodeReleaseSlug(slug: string): string | undefined {
  if (!slug || !slug.startsWith(FAIRPLAYER_ID_PREFIX) || slug.startsWith(FAIRPLAYER_ARTIST_PREFIX)) {
    return undefined;
  }
  try {
    return decodeURIComponent(slug.slice(FAIRPLAYER_ID_PREFIX.length));
  } catch {
    return undefined;
  }
}

function encodeArtistSlug(artistName: string): string {
  return `${FAIRPLAYER_ARTIST_PREFIX}${encodeURIComponent(artistName.trim())}`;
}

function decodeArtistSlug(slug: string): string | undefined {
  if (!slug || !slug.startsWith(FAIRPLAYER_ARTIST_PREFIX)) return undefined;
  try {
    const decoded = decodeURIComponent(slug.slice(FAIRPLAYER_ARTIST_PREFIX.length)).trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function getFaircampSiteUrl(releaseId: string): string {
  const match = releaseId.match(/^[^@/]+@([^@/]+)$/);
  if (!match) return FAIRPLAYER_ROOT;

  try {
    return new URL(`https://${match[1]}`).origin;
  } catch {
    return FAIRPLAYER_ROOT;
  }
}

function getFaircampDomain(releaseId: string): string | undefined {
  const match = releaseId.match(/^[^@/]+@([^@/]+)$/);
  if (!match) return undefined;

  try {
    const url = new URL(`https://${match[1]}`);
    if (url.username || url.password || url.pathname !== "/") return undefined;
    if (url.port && url.port !== "443") return undefined;
    const domain = normalizeDomain(url.hostname);
    if (isFaircampDomainBlocked(domain)) return undefined;
    return domain;
  } catch {
    return undefined;
  }
}

function recordKnownAlbum(album: AlbumProps): void {
  if (album.urlSlug) {
    const existing = knownAlbumsBySlug.get(album.urlSlug);
    if (!existing || (album.tracks && album.tracks.length > 0)) {
      knownAlbumsBySlug.set(album.urlSlug, album);
    }
  }
  if (album.artistId && album.artist?.name) {
    knownArtistsById.set(album.artistId, {
      name: album.artist.name,
      sourceUrl: album.sourceUrl,
    });
  }
}

function toAlbumProps(
  releaseId: string,
  title: string,
  artistName: string,
  coverUrl: string,
): AlbumProps {
  const artistId = hashId(`faircamp:${artistName.toLowerCase()}`);
  const albumId = hashId(`faircamp:${releaseId.toLowerCase()}`);
  const siteUrl = getFaircampSiteUrl(releaseId);
  const cover = {
    sizes: {
      60: coverUrl,
      120: coverUrl,
      300: coverUrl,
      600: coverUrl,
      960: coverUrl,
      1200: coverUrl,
      1500: coverUrl,
    },
  };

  const album: AlbumProps = {
    id: albumId,
    trackGroupId: albumId,
    title,
    artistId,
    artist: {
      id: artistId,
      name: artistName,
      urlSlug: "fairplayer",
      bio: "",
      activityPub: false,
      enabled: true,
      createdAt: "",
      trackGroups: [],
      userId: 0,
    },
    urlSlug: encodeReleaseSlug(releaseId),
    releaseDate: "",
    about: "",
    source: "Faircamp",
    sourceUrl: siteUrl,
    cover,
    tracks: [],
  };
  recordKnownAlbum(album);
  return album;
}

function parseReleaseCards(
  html: string,
  verifiedCatalogs?: Map<string, string>,
): AlbumProps[] {
  const cardPattern =
    /<a\b[^>]*\bhx-get\s*=\s*["']([^"']*\/player\/release\/[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi;
  const matchedSnippets: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = cardPattern.exec(html)) !== null) {
    const releaseId = getFaircampReleaseId(match[1] || "");
    if (!releaseId) continue;
    if (verifiedCatalogs) {
      const domain = getFaircampDomain(releaseId);
      if (!domain || !verifiedCatalogs.has(domain)) continue;
    }
    matchedSnippets.push(match[0]);
  }

  if (matchedSnippets.length === 0) return [];

  const root = parseHtml(matchedSnippets.join(""));
  const anchors = findElements(
    root,
    (node) => node.tagName === "a" && Boolean(getAttribute(node, "hx-get")),
  );
  const albums: AlbumProps[] = [];

  for (const card of anchors) {
    const releaseId = getFaircampReleaseId(getAttribute(card, "hx-get") || "");
    if (!releaseId) continue;

    const paragraphs = findElements(card, (node) => node.tagName === "p");
    const title =
      paragraphs.map((node) => getAttribute(node, "title")).find(Boolean) ||
      getText(paragraphs[0] || card);
    const artistName = getText(paragraphs[1] || { nodeName: "#text" });
    const coverUrl =
      getAttribute(
        findElements(card, (node) => node.tagName === "img")[0] || {
          nodeName: "",
        },
        "src",
      ) || "";

    if (!title || !artistName) continue;
    const album = toAlbumProps(releaseId, title, artistName, coverUrl);
    if (verifiedCatalogs) {
      const domain = getFaircampDomain(releaseId);
      if (domain && verifiedCatalogs.has(domain)) {
        album.sourceUrl = verifiedCatalogs.get(domain);
        recordKnownAlbum(album);
      }
    }
    albums.push(album);
  }

  return albums;
}

function parseSearchResults(raw: unknown): AlbumProps[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fairplayer search returned an invalid response.");
  }
  const items = (raw as FairplayerSearchResponse).items;
  if (!Array.isArray(items)) {
    throw new Error("Fairplayer search response did not include an item list.");
  }

  return items.flatMap((item) => {
    if (item.type !== "album" || !item.url || !item.name || !item.artist)
      return [];
    const releaseId = getFaircampReleaseId(item.url);
    if (!releaseId) return [];
    return [
      toAlbumProps(
        releaseId,
        item.name,
        item.artist,
        item.images?.default?.src || "",
      ),
    ];
  });
}

export function parseVerifiedFaircampCatalogs(
  html: string,
): Map<string, string> {
  const linkPattern = /<a\b[^>]*\bhref\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi;
  const matchedLinks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const snippet = match[0];
    if (
      /faircamp/i.test(snippet) &&
      (/bg-success/i.test(snippet) || /Verified/i.test(snippet))
    ) {
      matchedLinks.push(snippet);
    }
  }

  if (matchedLinks.length === 0) return new Map<string, string>();

  const root = parseHtml(matchedLinks.join(""));
  const catalogLinks = findElements(
    root,
    (node) =>
      node.tagName === "a" &&
      Boolean(getAttribute(node, "href")) &&
      /faircamp/i.test(getText(node)) &&
      findElements(
        node,
        (child) =>
          getAttribute(child, "title") === "Verified" ||
          hasClass(child, "bg-success"),
      ).length > 0,
  );
  const catalogs = new Map<string, string>();

  for (const link of catalogLinks) {
    try {
      const parsed = new URL(getAttribute(link, "href") || "");
      if (
        parsed.protocol === "https:" &&
        (!parsed.port || parsed.port === "443") &&
        !parsed.username &&
        !parsed.password
      ) {
        const domain = normalizeDomain(parsed.hostname);
        if (!isFaircampDomainBlocked(domain)) {
          catalogs.set(domain, parsed.href);
        }
      }
    } catch {
      continue;
    }
  }
  return catalogs;
}

function fairplayerEndpoint(path: string): URL {
  const url = new URL(path, SHARE_HUB_URL);
  if (url.origin !== new URL(SHARE_HUB_URL).origin) {
    throw new Error("Invalid Fairplayer proxy URL.");
  }
  return url;
}

let cachedVerifiedCatalogs: {
  fetchRef: typeof fetch;
  promise: Promise<Map<string, string>>;
  expiresAt: number;
} | null = null;

export async function fetchVerifiedFaircampCatalogs(
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const now = Date.now();
  if (
    cachedVerifiedCatalogs &&
    cachedVerifiedCatalogs.fetchRef === global.fetch &&
    cachedVerifiedCatalogs.expiresAt > now
  ) {
    return cachedVerifiedCatalogs.promise;
  }

  const currentFetch = global.fetch;
  const promise = (async () => {
    const html = await fetchFairplayerText(
      "/fairplayer/hub",
      "text/html",
      signal,
    );
    const catalogs = parseVerifiedFaircampCatalogs(html);
    if (catalogs.size === 0) {
      throw new Error(
        "Fairplayer hub did not list any verified Faircamp catalogs.",
      );
    }
    return catalogs;
  })();

  cachedVerifiedCatalogs = {
    fetchRef: currentFetch,
    promise,
    expiresAt: now + 5 * 60 * 1000,
  };

  promise.catch(() => {
    if (cachedVerifiedCatalogs?.promise === promise) {
      cachedVerifiedCatalogs = null;
    }
  });

  return promise;
}

async function fetchFairplayerText(
  path: string,
  accept: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(fairplayerEndpoint(path).toString(), {
    headers: { Accept: accept },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Fairplayer request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

export async function fetchFairplayerSongReleaseSlug(
  trackId: string,
  signal?: AbortSignal,
): Promise<string> {
  const syntheticTrack = trackId.match(/^(.+)#(\d+)$/);
  if (syntheticTrack) {
    const releaseId = syntheticTrack[1];
    if (!getFaircampDomain(releaseId)) {
      throw new Error("Invalid Fairplayer release identifier.");
    }
    return encodeReleaseSlug(releaseId);
  }
  if (!/^\d+$/.test(trackId)) {
    throw new Error("Invalid Fairplayer track identifier.");
  }
  const html = await fetchFairplayerText(
    `/fairplayer/player/song/${trackId}`,
    "text/html",
    signal,
  );
  const song = findElements(
    parseHtml(html),
    (node) =>
      node.tagName === "div" &&
      hasClass(node, "song") &&
      getAttribute(node, "data-id") === trackId,
  )[0];
  const releaseId = getFaircampReleaseId(
    getAttribute(song || { nodeName: "" }, "data-releaseurl") || "",
  );
  if (!releaseId) {
    throw new Error(`Fairplayer track has no valid release: ${trackId}`);
  }
  return encodeReleaseSlug(releaseId);
}

async function fetchVerifiedDirectoryAlbums(
  signal?: AbortSignal,
): Promise<AlbumProps[]> {
  const [html, verifiedCatalogs] = await Promise.all([
    fetchFairplayerText("/fairplayer/player/all/releases", "text/html", signal),
    fetchVerifiedFaircampCatalogs(signal),
  ]);
  const verifiedAlbums = parseReleaseCards(html, verifiedCatalogs);

  if (verifiedAlbums.length === 0 && verifiedCatalogs.size > 0) {
    throw new Error(
      "Fairplayer release directory did not include verified Faircamp releases.",
    );
  }

  return verifiedAlbums;
}

export async function fetchFairplayerAlbums(
  take: number = 40,
  signal?: AbortSignal,
): Promise<AlbumProps[]> {
  const verifiedAlbums = (await fetchVerifiedDirectoryAlbums(signal)).filter(
    (album) => {
      const releaseId = decodeReleaseSlug(album.urlSlug);
      const domain = releaseId ? getFaircampDomain(releaseId) : undefined;
      return Boolean(domain && !isFaircampDomainBlocked(domain));
    },
  );

  const shuffled = shuffleItems(verifiedAlbums);
  const artistsSeen = new Map<string, number>();
  const fairAlbums = shuffled.filter((album) => {
    const key = album.artist.name.toLowerCase().trim();
    const count = artistsSeen.get(key) || 0;
    if (count >= 2) return false;
    artistsSeen.set(key, count + 1);
    return true;
  });

  return fairAlbums.slice(0, take);
}

export async function searchFairplayerAlbums(
  searchTerm: string,
  signal?: AbortSignal,
): Promise<AlbumProps[]> {
  const endpoint = fairplayerEndpoint("/fairplayer/search");
  endpoint.searchParams.set("q", searchTerm.trim());
  const [response, verifiedCatalogs] = await Promise.all([
    fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
      signal,
    }),
    fetchVerifiedFaircampCatalogs(signal),
  ]);
  if (!response.ok) {
    throw new Error(
      `Fairplayer search failed: ${response.status} ${response.statusText}`,
    );
  }
  return parseSearchResults(await response.json()).filter((album) => {
    const releaseId = decodeReleaseSlug(album.urlSlug);
    const domain = releaseId ? getFaircampDomain(releaseId) : undefined;
    if (!domain || !verifiedCatalogs.has(domain)) return false;
    album.sourceUrl = verifiedCatalogs.get(domain);
    recordKnownAlbum(album);
    return true;
  });
}

export function parseFairplayerRelease(
  html: string,
  releaseSlug: string,
): AlbumProps {
  const releaseId = decodeReleaseSlug(releaseSlug);
  const releaseDomain = releaseId ? getFaircampDomain(releaseId) : undefined;
  if (!releaseId || !releaseDomain) {
    throw new Error("Invalid Faircamp release identifier.");
  }

  const root = parseHtml(html);
  const songs = findElements(
    root,
    (node) => node.tagName === "div" && hasClass(node, "song"),
  );

  if (songs.length === 0) {
    throw new Error(`Fairplayer release has no playable tracks: ${releaseId}`);
  }

  const albumTitle =
    getText(
      findElements(root, (node) => node.tagName === "h1")[0] || {
        nodeName: "#text",
      },
    ) || releaseId;
  const artistName = getAttribute(songs[0], "data-artist") || albumTitle;
  const artwork = getAttribute(songs[0], "data-image") || "";
  const album = toAlbumProps(releaseId, albumTitle, artistName, artwork);
  album.about =
    findElements(
      root,
      (node) =>
        node.tagName === "div" &&
        hasClass(node, "line-clamp-4") &&
        hasClass(node, "text-lg") &&
        findElements(node, (child) => child.tagName === "p").length > 0,
    )
      .map(getText)
      .find(Boolean) || "";

  // Summary without tracks so track.trackGroup never creates a circular reference
  const { tracks: _omittedTracks, ...trackGroupSummary } = album;

  album.tracks = songs.flatMap((song, index) => {
    const url = getAttribute(song, "data-url");
    const trackTitle = getAttribute(song, "data-title");
    if (!url || !trackTitle) return [];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return [];
    }
    if (
      parsedUrl.protocol !== "https:" ||
      (parsedUrl.port && parsedUrl.port !== "443") ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return [];
    }
    const trackDomain = normalizeDomain(parsedUrl.hostname);
    if (
      isFaircampDomainBlocked(trackDomain) ||
      (trackDomain !== releaseDomain && !trackDomain.endsWith(`.${releaseDomain}`))
    ) {
      return [];
    }

    const sourceTrackId = getAttribute(song, "data-id");
    const trackIdValue = sourceTrackId || `${releaseId}-${index}`;
    const numericTrackId = Number(trackIdValue);
    const trackId = Number.isSafeInteger(numericTrackId)
      ? numericTrackId
      : hashId(trackIdValue);
    const durationValue = Number(getAttribute(song, "data-duration"));
    const duration =
      Number.isFinite(durationValue) && durationValue > 0
        ? durationValue
        : undefined;

    const track: RNTrack = {
      id: trackId,
      title: trackTitle,
      artist: artistName,
      artwork,
      url,
      queueIndex: index,
      trackGroupId: album.id,
      order: index + 1,
      duration,
      isPreview: true,
      allowIndividualSale: false,
      headers: {},
      type: audioTrackType(url),
      source: "Faircamp",
      fairplayerTrackId:
        sourceTrackId && /^\d+$/.test(sourceTrackId)
          ? sourceTrackId
          : `${releaseId}#${index + 1}`,
      sourceUrl: album.sourceUrl,
      audio: { url, duration },
      trackGroup: { ...trackGroupSummary },
    };
    return [track];
  });

  if (album.tracks.length === 0) {
    throw new Error(
      `Fairplayer release contains no valid audio tracks: ${releaseId}`,
    );
  }

  recordKnownAlbum(album);
  return album;
}

export async function fetchFairplayerAlbum(
  releaseSlug: string,
  signal?: AbortSignal,
): Promise<AlbumProps> {
  const releaseId = decodeReleaseSlug(releaseSlug);
  const domain = releaseId ? getFaircampDomain(releaseId) : undefined;
  if (!releaseId || !domain) {
    throw new Error("Invalid Faircamp release identifier.");
  }

  const responsePath = `/fairplayer/player/release/${encodeURIComponent(releaseId)}`;
  const [html, verifiedCatalogs] = await Promise.all([
    fetchFairplayerText(responsePath, "text/html", signal),
    fetchVerifiedFaircampCatalogs(signal),
  ]);

  if (!verifiedCatalogs.has(domain)) {
    throw new Error(`Faircamp catalog is no longer verified: ${releaseId}`);
  }

  const album = parseFairplayerRelease(html, releaseSlug);
  album.sourceUrl = verifiedCatalogs.get(domain);
  album.tracks?.forEach((track) => {
    track.sourceUrl = album.sourceUrl;
    if (track.trackGroup) {
      track.trackGroup.sourceUrl = album.sourceUrl;
    }
  });
  recordKnownAlbum(album);
  return album;
}

export async function fetchFairplayerArtist(
  artistSlugOrId: string,
  signal?: AbortSignal,
): Promise<Artist | undefined> {
  const trimmed = String(artistSlugOrId || "").trim();
  if (!trimmed) return undefined;

  let artistName = decodeArtistSlug(trimmed);
  const numericId = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;

  if (!artistName && numericId !== undefined) {
    artistName = knownArtistsById.get(numericId)?.name;
  }

  if (!artistName && numericId !== undefined) {
    try {
      await fetchFairplayerAlbums(200, signal);
      artistName = knownArtistsById.get(numericId)?.name;
    } catch {
      // Fall through if directory is unavailable
    }
  }

  if (!artistName) return undefined;

  const targetLower = artistName.toLowerCase().trim();
  const targetArtistId = hashId(`faircamp:${targetLower}`);

  let searchedAlbums: AlbumProps[] = [];
  try {
    searchedAlbums = await searchFairplayerAlbums(artistName, signal);
  } catch {
    // Use known albums if search fails
  }

  if (searchedAlbums.length === 0 && knownAlbumsBySlug.size === 0) {
    try {
      await fetchFairplayerAlbums(200, signal);
    } catch {
      // Ignore directory failure
    }
  }

  const mergedBySlug = new Map<string, AlbumProps>();
  for (const album of [...searchedAlbums, ...knownAlbumsBySlug.values()]) {
    if (
      album.artistId === targetArtistId ||
      album.artist?.name?.toLowerCase().trim() === targetLower
    ) {
      mergedBySlug.set(album.urlSlug, album);
    }
  }

  const trackGroups = Array.from(mergedBySlug.values());
  const primaryAlbum = trackGroups[0];
  const resolvedName = primaryAlbum?.artist?.name || artistName;
  const sourceUrl =
    primaryAlbum?.sourceUrl || knownArtistsById.get(targetArtistId)?.sourceUrl;
  const coverUri = primaryAlbum?.cover?.sizes?.[600] || "";

  return {
    id: targetArtistId,
    name: resolvedName,
    urlSlug: encodeArtistSlug(resolvedName),
    bio: sourceUrl ? `Faircamp catalog: ${sourceUrl}` : `${resolvedName} on Faircamp.`,
    avatar: coverUri && primaryAlbum?.cover ? { sizes: primaryAlbum.cover.sizes } : undefined,
    activityPub: false,
    enabled: true,
    createdAt: "",
    trackGroups,
    userId: 0,
  };
}

export async function fetchFairplayerDiscoveryTracks(
  take: number = 2,
  signal?: AbortSignal,
): Promise<RNTrack[]> {
  if (take <= 0) return [];
  const albums = await fetchFairplayerAlbums(Math.max(take * 3, 12), signal);
  const pickedAlbums = shuffleItems(albums).slice(0, take);

  const settled = await Promise.allSettled(
    pickedAlbums.map((album) => fetchFairplayerAlbum(album.urlSlug, signal)),
  );

  const tracks: RNTrack[] = [];
  for (const res of settled) {
    if (res.status === "fulfilled" && res.value.tracks?.length) {
      const albumTracks = res.value.tracks;
      const randomTrack =
        albumTracks[Math.floor(Math.random() * albumTracks.length)];
      if (randomTrack) {
        tracks.push({
          ...randomTrack,
          autoplay: true,
        });
      }
    }
  }
  return tracks;
}

export function queryFairplayerAlbums(take: number = 40) {
  return queryOptions({
    queryKey: ["fairplayerAlbums", take],
    queryFn: ({ signal }) => fetchFairplayerAlbums(take, signal),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function queryFairplayerAlbum(releaseSlug: string) {
  return queryOptions({
    queryKey: ["fairplayerAlbum", releaseSlug],
    queryFn: ({ signal }) => fetchFairplayerAlbum(releaseSlug, signal),
    enabled: Boolean(decodeReleaseSlug(releaseSlug)),
    staleTime: 5 * 60 * 1000,
  });
}

export const fairplayerReleaseSlug = {
  encode: encodeReleaseSlug,
  decode: decodeReleaseSlug,
  encodeArtist: encodeArtistSlug,
  decodeArtist: decodeArtistSlug,
  siteUrl: (slug?: string) => {
    const releaseId = slug ? decodeReleaseSlug(slug) : undefined;
    return releaseId ? getFaircampSiteUrl(releaseId) : undefined;
  },
  artistRouteId: (slug: string) =>
    decodeReleaseSlug(slug) ? "fairplayer" : undefined,
  artistPageRouteId: (trackGroup?: {
    artistId?: number | string;
    artist?: { name?: string; urlSlug?: string };
    urlSlug?: string;
    source?: string;
  }) => {
    if (!trackGroup) return "";
    const isFaircamp =
      trackGroup.source === "Faircamp" ||
      Boolean(decodeReleaseSlug(String(trackGroup.urlSlug || "")));
    if (isFaircamp && trackGroup.artist?.name) {
      return encodeArtistSlug(trackGroup.artist.name);
    }
    return String(trackGroup.artistId || trackGroup.artist?.urlSlug || "");
  },
};

export const parseFairplayerReleaseCards = parseReleaseCards;
export const parseFairplayerSearchResults = parseSearchResults;

