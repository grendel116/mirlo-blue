import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import TrackGroupItem from "@/components/TrackGroupItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { queryTopSold } from "@/queries/queries";
import Ionicons from "@expo/vector-icons/Ionicons";
import ErrorNotification from "@/components/ErrorNotification";
import { useState } from "react";
import { theme } from "@/constants/theme";
import LoadingScreen from "@/components/LoadingScreen";

export default function Index() {
  const { isPending, isError, data, error } = useQuery(queryTopSold({}));
  const { top } = useSafeAreaInsets();
  const trackGroups = data?.results;
  const router = useRouter();
  const [showError, setShowError] = useState<boolean>(true);

  if (isPending) {
    return (
      <LoadingScreen />
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <ErrorNotification
          visible={showError}
          onDismiss={() => setShowError(false)}
          error={error}
        />
      </View>
    );
  }

  return (
    <View style={[styles.mainWrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.dismiss()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>POPULAR PURCHASES</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={trackGroups}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.navigate({
                pathname: "/artist/[id]/album/[slug]/album-tracks",
                params: { id: item.artistId, slug: item.urlSlug },
              })
            }
          >
            <TrackGroupItem
              id={item.id}
              cover={item.cover}
              title={item.title}
              artist={item.artist}
              artistId={item.artistId}
              urlSlug={item.urlSlug}
              userTrackGroupPurchases={item.userTrackGroupPurchases}
              releaseDate={item.releaseDate}
              tracks={item.tracks}
              trackGroupId={item.trackGroupId}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
    backgroundColor: theme.colors.surface,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    ...theme.typography.sectionHeader,
    fontSize: 14,
    color: theme.colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 4,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
