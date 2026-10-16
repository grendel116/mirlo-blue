import { openInBrowser } from "@/scripts/openInBrowser";
import { API_ROOT } from "@/constants/api-root";
import { getTrackPlaysSync, isTrackDisabledSync } from "@/scripts/trackPlayUtils";
import type { TrackType } from "react-native-track-player";

// Mirlo serves every track's audio as an HLS playlist at this path.
// List endpoints (wishlist, collection, favorites) omit audio.url, so derive it from the id.
export function trackStreamPath(trackId: number | string): string {
  return `/v1/tracks/${trackId}/stream/playlist.m3u8`;
}

/**
 * Validates that an artwork URL meets the lower quality threshold.
 * Rejects empty strings, legacy desktop .ico files, and known microscopic dimensions (<= 32px).
 */
export function isQualityArtwork(rawUrl?: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim().toLowerCase();
  if (
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("file://")
  ) {
    return false;
  }
  // Reject microscopic browser .ico files
  if (trimmed.endsWith(".ico") || trimmed.includes("/favicon.ico") || trimmed.includes("favicon.ico?")) {
    return false;
  }
  // Reject tiny thumbnail indicators in URL path or parameters (e.g. 16x16, 32x32)
  if (/(?:^|[^a-z0-9])(?:16x16|32x32|16px|32px)(?:[^a-z0-9]|$)/i.test(trimmed)) {
    return false;
  }
  if (/[?&](?:w|h|width|height|size)=(?:16|32)(?:&|$)/i.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * Resolves an image source only when it meets the artwork quality standards.
 */
export function resolveQualityArtworkSource(rawUrl?: string): { uri: string } | undefined {
  if (!isQualityArtwork(rawUrl)) return undefined;
  return { uri: resolveArtworkUrl(rawUrl) };
}

export function resolveArtworkUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${API_ROOT}${trimmed}`;
  }
  return `${API_ROOT}/${trimmed}`;
}

// The player's TrackType values are these same strings; a type-only import keeps the native
// player module out of this file
export function audioTrackType(url: string): TrackType {
  if (url.endsWith(".m3u8")) return "hls" as TrackType;
  if (url.endsWith(".mpd")) return "dash" as TrackType;
  return "default" as TrackType;
}

export interface TrackEntitlementContext {
  user?: LoggedInUser | null;
  trackGroup?: AlbumProps;
  playCount?: number;
  disabledTrackIds?: Set<number>;
}

/**
 * Evaluates whether a track can be played based on user ownership, release date,
 * and preview play thresholds.
 */
export function isTrackPlayable(
  track: RNTrack,
  context?: TrackEntitlementContext,
): boolean {
  const user = context?.user;
  const trackGroup = context?.trackGroup ?? track.trackGroup;

  // 1. Preview tracks are playable unless explicitly disabled or play cap reached
  if (track.isPreview) {
    const effectivePlayCount =
      context?.playCount ??
      (typeof track.id === "number" ? getTrackPlaysSync(track.id) : undefined);
    const isExhausted = Boolean(
      (track.id &&
        (context?.disabledTrackIds?.has(track.id) || isTrackDisabledSync(track.id))) ||
        (typeof trackGroup?.artist?.maxFreePlays === "number" &&
          typeof effectivePlayCount === "number" &&
          effectivePlayCount >= trackGroup.artist.maxFreePlays),
    );

    if (!isExhausted) {
      return true;
    }
  }

  // 2. Unreleased releases cannot be streamed
  if (trackGroup?.releaseDate && new Date(trackGroup.releaseDate) > new Date()) {
    return false;
  }

  // 3. User must be logged in to own a non-preview or exhausted track
  if (!user) {
    return false;
  }

  // 4. Owned tracks (bought individually, album purchased, or user is artist) remain playable
  return isTrackOwned(track, trackGroup, user);
}

export const isTrackOwnedOrPreview = (
  track: RNTrack,
  user?: LoggedInUser | null,
  trackGroup?: AlbumProps,
  disabledTrackIds?: Set<number>,
): boolean => isTrackPlayable(track, { user, trackGroup, disabledTrackIds });

export const isTrackOwned = (
  track: RNTrack,
  trackGroup?: AlbumProps,
  user?: LoggedInUser | null,
) => {
  if (!user || !track) {
    return false;
  }
  const lookInTrackGroup = trackGroup ?? track.trackGroup;

  // Checks if you are the owner/artist of the track
  const ownsTrack = Boolean(lookInTrackGroup && lookInTrackGroup.artistId === user.id);
  // Checks if you bought the track individually
  const boughtTrack = Boolean(
    user.userTrackPurchases?.some((utp) => utp.trackId === track.id),
  );
  // Checks if you bought the album that the track belongs to
  const albumId =
    lookInTrackGroup?.id ??
    (lookInTrackGroup as any)?.trackGroupId ??
    track.trackGroupId;
  const boughtTrackGroup = Boolean(
    lookInTrackGroup?.userTrackGroupPurchases?.some((utgp) => utgp.userId === user.id) ||
      (albumId && user.userTrackGroupPurchases?.some((utgp) => utgp.trackGroupId === albumId)),
  );
  return ownsTrack || boughtTrack || boughtTrackGroup;
};

/**
 * Converts rich HTML formatting (e.g. from Faircamp/Chorus feeds) to clean Markdown.
 */
export function htmlToMarkdown(html?: string): string {
  if (!html || typeof html !== "string") return "";
  if (!html.includes("<") && !html.includes("&")) return html;

  return html
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, "*$2*")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/&rsquo;|&lsquo;|&#8217;|&#8216;|&apos;|&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&hellip;|&#8230;/g, "...")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const linkifyUrls = (text: string) => {
  // Simple regex to find URLs that aren't already in markdown format
  const urlRegex = /(?<!\]\()https?:\/\/[^\s\)]+(?!\))/g;

  return text.replace(urlRegex, (url) => {
    // Convert plain URLs to markdown format
    return `[${url}](${url})`;
  });
};

export const handleExternalPurchase = (
  trackGroup: Partial<AlbumProps> | AlbumProps,
  specificUrl?: string,
) => {
  if (specificUrl) {
    openInBrowser(specificUrl);
    return;
  }
  if (trackGroup.purchaseLinks && trackGroup.purchaseLinks.length > 0) {
    const mirloOption = trackGroup.purchaseLinks.find((l) => l.url.includes("mirlo.space"));
    if (mirloOption) {
      openInBrowser(mirloOption.url);
      return;
    }
    openInBrowser(trackGroup.purchaseLinks[0].url);
    return;
  }
  if (trackGroup.sourceUrl && !trackGroup.sourceUrl.includes("mirlo.space")) {
    openInBrowser(trackGroup.sourceUrl);
    return;
  }
  const artistSlug = trackGroup.artist?.urlSlug;
  const albumSlug = trackGroup.urlSlug;
  if (
    artistSlug &&
    artistSlug !== "fairplayer" &&
    albumSlug &&
    !albumSlug.startsWith("fairplayer-")
  ) {
    openInBrowser(`https://mirlo.space/${artistSlug}/release/${albumSlug}`);
  } else if (artistSlug && artistSlug !== "fairplayer") {
    openInBrowser(`https://mirlo.space/${artistSlug}`);
  } else if (trackGroup.sourceUrl) {
    openInBrowser(trackGroup.sourceUrl);
  }
};

// The song's page on mirlo.space. Social apps and messages show it with the cover art
export function songPageUrl(track: RNTrack): string | undefined {
  const artistSlug = track.trackGroup?.artist?.urlSlug;
  const albumSlug = track.trackGroup?.urlSlug;
  if (
    !artistSlug ||
    artistSlug === "fairplayer" ||
    !albumSlug ||
    albumSlug.startsWith("fairplayer-") ||
    !track.id
  ) {
    return undefined;
  }
  return `https://mirlo.space/${artistSlug}/release/${albumSlug}/tracks/${track.id}`;
}

// True when you bought this album (including adding it free), or it's your own
export const ownsAlbum = (user: LoggedInUser | null | undefined, album: AlbumProps): boolean =>
  !!user &&
  (album.artistId === user.id ||
    !!album.userTrackGroupPurchases?.some((p) => p.userId === user.id) ||
    !!user.userTrackGroupPurchases?.some((p) => p.trackGroupId === album.id));
