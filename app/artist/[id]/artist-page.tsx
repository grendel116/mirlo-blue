import { useQuery } from "@tanstack/react-query";
import { queryArtist } from "@/queries/queries";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Markdown from "react-native-markdown-display";
import React from "react";
import { useTranslation } from "react-i18next";
import { linkifyUrls } from "@/scripts/utils";
import { theme } from "@/constants/theme";

export default function ArtistPage() {
  const { id } = useLocalSearchParams();
  const { data, isError, isPending, error } = useQuery(
    queryArtist({ artistSlug: String(id) ?? "" }),
  );
  const { t } = useTranslation("translation");
  const router = useRouter();

  if (isPending) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Error loading artist: {error.message}</Text>
      </View>
    );
  }

  const artistInfo = data;

  const getModifiedData = (data: any) => {
    if (!data || data.length === 0) return [];
    if (data.length % 2 !== 0) {
      return [...data, { id: "placeholder", isPlaceholder: true }];
    }
    return data;
  };

  const handleEmpty = () => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No releases found for this artist.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <Pressable
          onPress={() => router.dismiss()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        horizontal={false}
        columnWrapperStyle={styles.columnWrapper}
        numColumns={2}
        ListEmptyComponent={handleEmpty}
        data={getModifiedData(artistInfo.trackGroups)}
        renderItem={({ item }) => {
          if (item.isPlaceholder) {
            return <View style={[styles.albumItem, { opacity: 0 }]} />;
          }

          return (
            <Pressable
              style={styles.albumItem}
              onPress={() =>
                router.navigate({
                  pathname: "/artist/[id]/album/[slug]/album-tracks",
                  params: { id: item.artistId, slug: item.urlSlug },
                })
              }
            >
              <View style={styles.albumCoverWrap}>
                <Image
                  style={styles.albumCover}
                  source={{
                    uri: item.cover?.sizes?.[600] || "",
                  }}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.albumTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => (
          <View style={styles.headerContainer}>
            {artistInfo.banner ? (
              <Image
                style={styles.bannerImage}
                source={{
                  uri: artistInfo.banner?.sizes?.[625] || "",
                }}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.introBanner}>
              {artistInfo.avatar ? (
                <Image
                  style={styles.avatar}
                  source={{
                    uri: artistInfo.avatar?.sizes?.[600] || "",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={28} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.artistDetails}>
                <Text style={styles.artistName}>
                  {artistInfo.name}
                </Text>
                {artistInfo.location ? (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={15}
                      color={theme.colors.textCyan}
                    />
                    <Text style={styles.locationText}>
                      {artistInfo.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.releasesHeader}>DISCOGRAPHY</Text>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.footerContainer}>
            <Text style={styles.aboutHeader}>
              {t("trackGroupDetails.about")}
            </Text>

            {artistInfo.bio ? (
              <Markdown
                style={{
                  body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
                  link: { color: theme.colors.textCyan },
                }}
              >
                {linkifyUrls(
                  artistInfo.bio.replace(/([^\n])\n([^\n])/g, "$1 $2"),
                )}
              </Markdown>
            ) : (
              <Text style={styles.bioFallback}>
                {`${artistInfo.name} is an artist on Mirlo.`}
              </Text>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const itemWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
  },
  backBtn: {
    padding: 6,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  list: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContainer: {
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  bannerImage: {
    width: "100%",
    height: 160,
    backgroundColor: theme.colors.surface,
  },
  introBanner: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  artistDetails: {
    marginLeft: 14,
    flex: 1,
    gap: 4,
  },
  artistName: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  releasesHeader: {
    ...theme.typography.sectionHeader,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  albumItem: {
    width: itemWidth,
    marginBottom: 18,
  },
  albumCoverWrap: {
    width: itemWidth,
    height: itemWidth,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  albumCover: {
    width: "100%",
    height: "100%",
  },
  albumTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  footerContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
  aboutHeader: {
    ...theme.typography.sectionHeader,
    marginBottom: 10,
  },
  bioFallback: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
});
