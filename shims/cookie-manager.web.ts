// Clean web shim for @preeternal/react-native-cookie-manager using SecureStore (localStorage)
import * as SecureStore from "expo-secure-store";

const CookieManager = {
  get: async (_url: string) => {
    const jwt = await SecureStore.getItemAsync("jwt");
    const refresh = await SecureStore.getItemAsync("refresh");
    const cookies: Record<string, { value: string }> = {};
    if (jwt) cookies.jwt = { value: jwt };
    if (refresh) cookies.refresh = { value: refresh };
    return cookies;
  },
  clearAll: async (_useWebKit?: boolean) => {
    await SecureStore.deleteItemAsync("jwt");
    await SecureStore.deleteItemAsync("refresh");
    return true;
  },
  getAll: async () => {
    const jwt = await SecureStore.getItemAsync("jwt");
    const refresh = await SecureStore.getItemAsync("refresh");
    const cookies: Record<string, { value: string }> = {};
    if (jwt) cookies.jwt = { value: jwt };
    if (refresh) cookies.refresh = { value: refresh };
    return cookies;
  },
  set: async (_url: string, cookie: { name: string; value: string }) => {
    if (cookie?.name) {
      await SecureStore.setItemAsync(cookie.name, cookie.value);
    }
    return true;
  },
  clearByName: async (_url: string, name: string) => {
    await SecureStore.deleteItemAsync(name);
    return true;
  },
};

export default CookieManager;
