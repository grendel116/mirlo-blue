import { StyleSheet, Text, View, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { openInBrowser } from "@/scripts/openInBrowser";
import { Loading } from "./ui";

export type InAppStoreViewProps = {
  url: string;
  title?: string;
  source?: string;
  onClose: () => void;
};

export const FAIRCAMP_INJECTED_CSS = `
  :root, html, body {
    --bg-1: ${theme.colors.background} !important;
    --bg-1-90: ${theme.colors.background} !important;
    --bg-1-overlay: ${theme.colors.surfaceElevated} !important;
    --bg-2: ${theme.colors.surfaceElevated} !important;
    --bg-2-overlay: ${theme.colors.surface} !important;
    --bg-3: ${theme.colors.surface} !important;
    --bg-acc: ${theme.colors.primary} !important;
    --bg-acc-overlay: ${theme.colors.primaryGlow} !important;
    --bg-mg: ${theme.colors.surfaceCardBorder} !important;
    --fg-1: ${theme.colors.textPrimary} !important;
    --fg-2: ${theme.colors.textSecondary} !important;
    --fg-3: ${theme.colors.textMuted} !important;
    --fg-acc: ${theme.colors.background} !important;
    --mg: ${theme.colors.surfaceCardBorder} !important;
    --mg-acc: ${theme.colors.primary} !important;
    background-color: ${theme.colors.background} !important;
    background-image: none !important;
    color: ${theme.colors.textPrimary} !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  }

  html, body, main, #content, .layout, .page, .page_center, [style*="background"] {
    background-image: none !important;
  }

  /* Strip website chrome */
  header,
  footer,
  nav,
  .skip_to_content,
  #more,
  .site_title {
    display: none !important;
  }

  .layout {
    min-height: auto !important;
    padding: 0 !important;
    background-color: ${theme.colors.background} !important;
  }

  .page {
    padding: 16px 12px !important;
    background-color: transparent !important;
  }

  .page_center {
    margin: 0 auto !important;
    max-width: 480px !important;
  }

  h1, h2, h3 {
    color: ${theme.colors.textPrimary} !important;
    letter-spacing: -0.02em !important;
  }

  p, label, span {
    color: ${theme.colors.textSecondary} !important;
  }

  .release_compact {
    background-color: ${theme.colors.surfaceElevated} !important;
    border: 1px solid ${theme.colors.surfaceCardBorder} !important;
    border-radius: ${theme.radius.md}px !important;
    padding: 12px !important;
    margin-bottom: 16px !important;
  }

  .release_compact a {
    color: ${theme.colors.textPrimary} !important;
    text-decoration: none !important;
    font-weight: 600 !important;
  }

  .release_compact img {
    border-radius: ${theme.radius.sm}px !important;
  }

  /* Price inputs */
  input[type="text"],
  input[type="number"] {
    background-color: ${theme.colors.surfaceElevated} !important;
    color: ${theme.colors.textPrimary} !important;
    border: 1px solid ${theme.colors.surfaceCardBorder} !important;
    border-radius: ${theme.radius.sm}px !important;
    padding: 10px 14px !important;
    font-size: 16px !important;
  }

  input[type="text"]:focus {
    border-color: ${theme.colors.primary} !important;
    outline: none !important;
    box-shadow: 0 0 0 1px ${theme.colors.primary} !important;
  }

  /* Action buttons */
  button,
  .button,
  #continue {
    background-color: ${theme.colors.primary} !important;
    color: ${theme.colors.background} !important;
    font-weight: 700 !important;
    border-radius: ${theme.radius.md}px !important;
    border: none !important;
    padding: 12px 24px !important;
    font-size: 15px !important;
    cursor: pointer !important;
    box-shadow: 0 4px 12px ${theme.colors.primaryGlow} !important;
  }

  button.disabled,
  #continue.disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    box-shadow: none !important;
  }

  /* Download format buttons */
  .download_formats {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    margin: 16px 0 !important;
  }

  .download_entry a {
    display: block !important;
    background-color: ${theme.colors.surfaceElevated} !important;
    color: ${theme.colors.primary} !important;
    border: 1px solid ${theme.colors.surfaceCardBorder} !important;
    border-radius: ${theme.radius.md}px !important;
    padding: 14px 18px !important;
    text-decoration: none !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    transition: border-color 0.15s ease !important;
  }

  .download_entry a:active {
    border-color: ${theme.colors.primary} !important;
  }

  /* Payment links */
  .payment a {
    color: ${theme.colors.primary} !important;
    font-weight: 600 !important;
    text-decoration: underline !important;
  }

  input[type="checkbox"] {
    accent-color: ${theme.colors.primary} !important;
    width: 18px !important;
    height: 18px !important;
    cursor: pointer !important;
  }
`;

const INJECT_FAIRCAMP_SKIN_SCRIPT = `
(function() {
  function applySkin() {
    if (document.getElementById('faircamp-mirlo-skin')) return;
    const style = document.createElement('style');
    style.id = 'faircamp-mirlo-skin';
    style.textContent = \`${FAIRCAMP_INJECTED_CSS}\`;
    (document.head || document.documentElement).appendChild(style);
  }
  applySkin();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySkin);
  }
})();
true;
`;

export function InAppStoreView({ url, title, source, onClose }: InAppStoreViewProps) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = source || "Store";
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Mirlo"
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || source || "External Store"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {hostname}
          </Text>
        </View>

        <Pressable
          onPress={() => openInBrowser(url)}
          style={styles.openExternalButton}
          accessibilityRole="button"
          accessibilityLabel="Open in external browser"
        >
          <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <WebView
        source={{ uri: url }}
        injectedJavaScriptBeforeContentLoaded={INJECT_FAIRCAMP_SKIN_SCRIPT}
        injectedJavaScript={INJECT_FAIRCAMP_SKIN_SCRIPT}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Loading label={`Opening ${source || "store"}...`} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  openExternalButton: {
    padding: 6,
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
});
