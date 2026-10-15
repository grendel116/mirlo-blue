import { Platform } from "react-native";

export const API_ROOT =
  Platform.OS === "web" && typeof window !== "undefined"
    ? (process.env.EXPO_PUBLIC_API_ROOT_WEB ?? "/api")
    : (process.env.EXPO_PUBLIC_API_ROOT ?? "https://mirlo.space");
