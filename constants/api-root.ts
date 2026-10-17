import { Platform } from "react-native";
import { SHARE_HUB_URL } from "@/queries/shareHub";

// Browsers reach Mirlo through the share worker, which carries login tokens
// that Mirlo's cookies can't deliver across sites
export const API_ROOT =
  Platform.OS === "web"
    ? new URL("/mirlo", SHARE_HUB_URL).href
    : (process.env.EXPO_PUBLIC_API_ROOT ?? "https://mirlo.space");
