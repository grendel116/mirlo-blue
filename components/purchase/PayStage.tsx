import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "@/constants/theme";
import { isCheckoutCompleteUrl } from "@/queries/listener";
import type { PayStageProps } from "./useCheckout";
import { Loading, SecondaryButton } from "./ui";

// Mirlo's checkout page inside the sheet. Once paid, Mirlo sends the page to its
// checkout-complete address; the sheet stops there and moves on to confirming
export function PayStage({ checkoutUrl, onPaid, onCancel }: PayStageProps) {
  const proceed = (url: string) => {
    if (!isCheckoutCompleteUrl(url)) return true;
    onPaid();
    return false;
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: checkoutUrl }}
        onShouldStartLoadWithRequest={(request) => proceed(request.url)}
        // The page can also change its address in place, without a new load
        onNavigationStateChange={(state) => proceed(state.url)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Loading label="Opening Mirlo's checkout" />
          </View>
        )}
        style={styles.webview}
      />
      <View style={styles.footer}>
        <SecondaryButton label="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
});
