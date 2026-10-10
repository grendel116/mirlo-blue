// Clean web shim for expo-secure-store using browser localStorage
export async function getItemAsync(key: string): Promise<string | null> {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(`mirlo_secure_${key}`);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(`mirlo_secure_${key}`, value);
  } catch {}
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`mirlo_secure_${key}`);
  } catch {}
}

export async function isAvailableAsync(): Promise<boolean> {
  return typeof window !== "undefined" && !!window.localStorage;
}
