import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { MirloFetchError } from "./fetch/MirloFetchError";
import { authRefresh } from "./authQueries";

// Coming back to the app (e.g. after buying an album in the browser) reloads stale data
if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) =>
      setFocused(state === "active"),
    );
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, //30 seconds
      retry: (failureCount, error) => {
        // don't retyr for auth-related errors
        if (
          error instanceof MirloFetchError &&
          (error.status === 400 || error.status === 401)
        ) {
          return false;
        }

        return failureCount <= 1;
      },
    },
  },
  queryCache: new QueryCache({
    onError: async (error) => {
      if (
        error instanceof MirloFetchError &&
        (error.status === 400 || error.status === 401)
      ) {
        console.error(`Received a ${error.status} response - refreshing auth`);
        await authRefresh();
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.includes("auth"),
        });
      }
    },
  }),
});

export function QueryClientWrapper(
  props: React.PropsWithChildren<{ devTools?: boolean }>
) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
