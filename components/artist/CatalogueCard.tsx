import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { formatMoney, queryCatalogPrice } from "@/queries/listener";
import { openPurchase } from "@/scripts/openPurchase";

// Offers every release the artist sells in one purchase, shown when the artist turns it on
// and the catalogue has a price
export default function CatalogueCard({ artist, routeId }: { artist: Artist; routeId: string }) {
  const router = useRouter();
  const { data: price } = useQuery(
    queryCatalogPrice(artist.id, Boolean(artist.purchaseEntireCatalogEnabled)),
  );
  if (!artist.purchaseEntireCatalogEnabled || !price) return null;

  const count = artist.trackGroups?.length ?? 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => openPurchase(router, { kind: "catalogue", artist: routeId })}
      accessibilityRole="button"
      accessibilityLabel={`Buy all ${count} releases by ${artist.name}`}
    >
      <Ionicons name="albums-outline" size={26} color={theme.colors.primary} />
      <View style={styles.text}>
        <Text style={styles.title}>
          {count === 1 ? "Own the release" : `Own all ${count} releases`}
        </Text>
        <Text style={styles.subtitle}>Everything {artist.name} sells, in one purchase</Text>
      </View>
      <Text style={styles.price}>{formatMoney(price, artist.user?.currency)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  price: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
