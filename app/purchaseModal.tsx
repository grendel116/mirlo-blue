import DismissModalBar from "@/components/DismissModalBar";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { theme } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { handleExternalPurchase } from "@/scripts/utils";

export function formatPurchaseButtonLabel(
  label?: string,
  fallbackSource = "Mirlo",
): string {
  const sourceName = label?.trim() || fallbackSource;
  const lower = sourceName.toLowerCase();

  // Explicit actions like "Subscribe on Mirlo" or "Support on Patreon"
  if (lower.startsWith("subscribe") || lower.startsWith("support")) {
    return sourceName;
  }
  if (lower.includes("subscription")) {
    const provider = sourceName.replace(/subscription/i, "").trim();
    return provider
      ? `Subscribe on ${provider}`
      : `Subscribe on ${fallbackSource}`;
  }

  // Clean up any leading "Buy on" or "Purchase on" to avoid duplicate prefixes
  const cleanSource = sourceName
    .replace(/^(buy|purchase)\s+on\s+/i, "")
    .replace(/^(buy|purchase)\s+/i, "")
    .trim();

  // If the label was generic "Album" or "Release", use fallbackSource
  const isGeneric =
    !cleanSource ||
    cleanSource.toLowerCase() === "album" ||
    cleanSource.toLowerCase() === "release";

  // Normalize Mirlo Space / mirlo to "Mirlo"
  const normalizedSource = isGeneric
    ? fallbackSource
    : cleanSource.toLowerCase() === "mirlo space" ||
        cleanSource.toLowerCase() === "mirlo"
      ? "Mirlo"
      : cleanSource;

  return `Purchase on ${normalizedSource}`;
}

export default function PurchaseModal() {
  const router = useRouter();
  const {
    trackGroupTitle,
    trackGroupId,
    artistId,
    artist,
    source,
    sourceUrl,
    purchaseLinks,
    urlSlug,
    artistUrlSlug,
  } = useLocalSearchParams();

  const resolvedSource =
    typeof source === "string" && source.trim() ? source.trim() : "Mirlo";

  const parsedPurchaseLinks = useMemo((): { label: string; url: string }[] => {
    if (typeof purchaseLinks === "string" && purchaseLinks.trim().length > 0) {
      try {
        return JSON.parse(purchaseLinks);
      } catch (err) {
        console.warn("Issue parsing purchaseLinks in purchaseModal", err);
      }
    }
    return [];
  }, [purchaseLinks]);

  const onSelectPurchase = useCallback(
    (url?: string) => {
      const albumProps: Partial<AlbumProps> = {
        id: Number(trackGroupId) || 0,
        title: String(trackGroupTitle || ""),
        artistId: Number(artistId) || 0,
        artist: {
          id: Number(artistId) || 0,
          name: String(artist || ""),
          urlSlug: String(artistUrlSlug || ""),
        } as any,
        urlSlug: String(urlSlug || ""),
        source: source ? String(source) : undefined,
        sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
        purchaseLinks:
          parsedPurchaseLinks.length > 0 ? parsedPurchaseLinks : undefined,
      };

      handleExternalPurchase(albumProps, url);
      router.dismiss();
    },
    [
      trackGroupId,
      trackGroupTitle,
      artistId,
      artist,
      artistUrlSlug,
      urlSlug,
      source,
      sourceUrl,
      parsedPurchaseLinks,
      router,
    ],
  );

  const singleLabel = formatPurchaseButtonLabel(
    parsedPurchaseLinks[0]?.label,
    resolvedSource,
  );

  return (
    <SafeAreaView style={styles.container}>
      <DismissModalBar />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="bag-handle-outline"
              size={36}
              color={theme.colors.primary}
            />
          </View>

          <Text style={styles.title}>
            {trackGroupTitle ? (
              <>
                Purchase{" "}
                <Text style={styles.titleHighlight}>
                  {trackGroupTitle}
                </Text>
              </>
            ) : (
              <>
                Support{" "}
                <Text style={styles.titleHighlight}>
                  {artist || "the Artist"}
                </Text>
              </>
            )}
          </Text>

          <Text style={styles.subtitle}>
            Purchasing directly supports {artist || "the artist"} and unlocks
            permanent full playback and audio downloads.
          </Text>

          {parsedPurchaseLinks.length > 1 ? (
            <View style={styles.buttonContainer}>
              {parsedPurchaseLinks.map((opt, idx) => {
                const label = formatPurchaseButtonLabel(
                  opt.label,
                  resolvedSource,
                );
                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.actionButton,
                      idx > 0 && styles.secondaryButton,
                    ]}
                    onPress={() => onSelectPurchase(opt.url)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        idx > 0 && styles.secondaryButtonText,
                      ]}
                    >
                      {label}
                    </Text>
                    <Ionicons
                      name="open-outline"
                      size={16}
                      color={
                        idx === 0
                          ? theme.colors.playButtonIcon
                          : theme.colors.primary
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              style={styles.actionButton}
              onPress={() => onSelectPurchase(parsedPurchaseLinks[0]?.url)}
              accessibilityRole="button"
              accessibilityLabel={singleLabel}
            >
              <Text style={styles.buttonText}>{singleLabel}</Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={theme.colors.playButtonIcon}
              />
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    padding: 28,
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 210, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  titleHighlight: {
    color: theme.colors.textCyan,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  actionButton: {
    width: "100%",
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.playButtonIcon,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
  },
});
