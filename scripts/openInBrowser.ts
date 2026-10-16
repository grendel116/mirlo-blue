import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { isFaircampDomainBlocked } from "@/queries/fairplayer";

export function isSafeExternalUrl(rawUrl?: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.port && parsed.port !== "443") return false;
  if (parsed.username || parsed.password) return false;
  if (isFaircampDomainBlocked(parsed.hostname)) return false;
  return true;
}

// Opens a web page in an in-app browser sheet. On Android the Custom Tab intent
// has to name a browser: an implicit VIEW intent for a mirlo.space URL resolves
// to this app (it handles that domain) and loops
export async function openInBrowser(url: string) {
  if (!isSafeExternalUrl(url)) return;
  let browserPackage: string | undefined;
  if (Platform.OS === "android") {
    const b = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
    browserPackage =
      b.preferredBrowserPackage ??
      b.defaultBrowserPackage ??
      b.browserPackages[0];
    if (!browserPackage) return;
  }
  await WebBrowser.openBrowserAsync(url, { browserPackage });
}
