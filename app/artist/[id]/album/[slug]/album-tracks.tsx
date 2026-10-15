import {
  Text,
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Modal} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useLocalSearchParams,
  useRouter,
  Link,
  useFocusEffect,
} from "expo-router";
import { usePlayer } from "@/state/PlayerContext";
import { audioTrackType, handleExternalPurchase, isTrackOwnedOrPreview } from "@/scripts/utils";
import { useAuthContext } from "@/state/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { queryAlbum } from "@/queries/queries";
import React, { useCallback, useState } from "react";
import { API_ROOT } from "@/constants/api-root";
import { API_KEY } from "@/constants/api-key";
import TrackPlayer, { State } from "react-native-track-player";
import Ionicons from "@expo/vector-icons/Ionicons";
import PlayPauseWrapper from "@/components/PlayPauseWrapper";
import { useTranslation } from "react-i18next";
import Markdown from "react-native-markdown-display";
import { linkifyUrls } from "@/scripts/utils";
import WishlistButton from "@/components/WishlistButton";
import ErrorNotification from "@/components/ErrorNotification";
import AddAlbumButton from "@/components/AddAlbumButton";
import DownloadAlbumButton from "@/components/DownloadAlbumButton";
import { mirloRed } from "@/constants/mirlo-red";
import { theme } from "@/constants/theme";
import TagPill from "@/components/TagPill";
import { recordHistoryItem } from "@/scripts/historyManager";
import LoadingScreen from "@/components/LoadingScreen";

type DateTimeFormatOptions = Intl.DateTimeFormatOptions;

function AlbumPlayButton() {
  const {
    isPlaying,
    activeTrack,
    playableTracks,
    playTrack,
    togglePlayPause,
  } = usePlayer();

  const isCurrentAlbum = Boolean(
    activeTrack &&
      playableTracks.length > 0 &&
      activeTrack.trackGroup?.urlSlug === playableTracks[0]?.trackGroup?.urlSlug,
  );

  const togglePlayback = useCallback(async () => {
    if (!playableTracks.length) return;
    if (isCurrentAlbum) {
      await togglePlayPause();
    } else {
      await playTrack(playableTracks[0], playableTracks);
    }
  }, [isCurrentAlbum, playableTracks, playTrack, togglePlayPause]);

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      disabled={!playableTracks.length}
      accessibilityRole="button"
      accessibilityLabel={isCurrentAlbum && isPlaying ? "Pause Album" : "Play Album"}
      style={styles.albumPlayBtn}
    >
      <Ionicons
        name={
          playableTracks.length
            ? isCurrentAlbum && isPlaying
              ? "pause"
              : "play"
            : "play"
        }
        size={24}
        color={theme.colors.playButtonIcon}
      />
    </TouchableOpacity>
  );
}

const MemoizedAlbumPlayButton = React.memo(AlbumPlayButton);

function formatUTCDate(utcDate: string | undefined) {
  const { t } = useTranslation("translation");
  if (!utcDate) return undefined;
  const date = new Date(utcDate);

  // Account for timezone offset
  const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);

  const options: DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const result = localDate.toLocaleDateString("en-US", options);

  return date.getTime() > Date.now()
    ? `${t("trackGroupCard.releaseDate")} ${result}`
    : t("trackGroupCard.released").substring(
        0,
        t("trackGroupCard.released").indexOf(":") + 1,
      ) + ` ${result}`;
}

export default function AlbumTracks() {
  const { id, slug } = useLocalSearchParams();
  const { isPending, isError, data, error } = useQuery(
    queryAlbum({ slug: slug, id: id }),
  );
  const router = useRouter();
  const { setPlayableTracks } = usePlayer();
  const { user } = useAuthContext();
  const [album, setAlbum] = useState<RNTrack[]>();
  const { t } = useTranslation("translation");
  const { width } = useWindowDimensions();
  const [showError, setShowError] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      const tracksToPlay: RNTrack[] = [];
      const allTracks: RNTrack[] = [];
      let playableIndex = 0;

      if (data && data.result) {
        // Record album in Viewing History
        recordHistoryItem({
          id: data.result.id,
          artistId: data.result.artistId,
          urlSlug: data.result.urlSlug,
          title: data.result.title,
          artistName: data.result.artist?.name || "",
          coverUri:
            data.result.cover?.sizes?.[300] ||
            data.result.cover?.sizes?.[600] ||
            data.result.cover?.sizes?.[120],
        });

        if (data.result.tracks) {
          data.result.tracks.forEach((track) => {
            const newTrack: RNTrack = {
              title: track.title,
              artist: data.result.artist.name,
              artwork: data.result.cover.sizes[600],
              url: `${API_ROOT}${track.audio.url}`,
              allowIndividualSale: track.allowIndividualSale,
              id: track.id,
              trackArtists: track.trackArtists,
              queueIndex: track.order,
              trackGroupId: data.result.trackGroupId,
              trackGroup: {
                userTrackGroupPurchases: data.result.userTrackGroupPurchases,
                artistId: data.result.artistId,
                urlSlug: data.result.urlSlug,
                cover: data.result.cover,
                title: data.result.title,
                artist: data.result.artist,
                id: data.result.id,
                releaseDate: data.result.releaseDate,
                trackGroupId: data.result.trackGroupId,
              },
              audio: {
                url: track.audio.url,
                duration: track.audio.duration,
              },
              isPreview: track.isPreview,
              order: track.order,
              headers: {
                "mirlo-api-key": API_KEY,
              },
              type: audioTrackType(track.audio.url),
            };

            allTracks.push(newTrack);

            if (isTrackOwnedOrPreview(newTrack, user, data.result)) {
              newTrack.queueIndex = playableIndex;
              playableIndex++;
              tracksToPlay.push(newTrack);
            }
          });
        }
      }
      setAlbum(allTracks);
      setPlayableTracks(tracksToPlay);
    }, [data, user]),
  );

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

  const selectedAlbum = data.result;

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
      <View style={styles.container}>
        <FlatList
          style={{ width: "100%" }}
          contentContainerStyle={styles.listContainer}
          data={album}
          keyExtractor={(item, index) => `${index}-${item.id || item.title}`}
          renderItem={({ item }) =>
            selectedAlbum ? (
              <PlayPauseWrapper
                trackObject={item}
                selectedAlbum={selectedAlbum}
                onTrackScreen={false}
              />
            ) : null
          }
          ListHeaderComponent={() => (
            <View style={styles.headerSection}>
              <View style={styles.coverWrapper}>
                <Image
                  source={{ uri: selectedAlbum?.cover?.sizes[600] }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.albumMetaRow}>
                <View style={styles.metaTitles}>
                  <Text
                    style={styles.albumMainTitle}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {selectedAlbum?.title}
                  </Text>
                  <View style={styles.artistNameRow}>
                    <Text style={styles.byText}>
                      {t("trackGroupDetails.byArtist")
                        .replace(/<[^>]*>.*?<\/[^>]*>/g, "")
                        .trim() + " "}
                    </Text>
                    <Pressable
                      onPress={() =>
                        router.navigate({
                          pathname: "/artist/[id]/artist-page",
                          params: { id: selectedAlbum?.artistId },
                        })
                      }
                    >
                      <Text style={styles.artistLink}>
                        {selectedAlbum?.artist.name}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.albumActions}>
                  <AddAlbumButton
                    trackGroup={selectedAlbum}
                    size={36}
                    setModalVisible={setModalVisible}
                  />
                  <WishlistButton
                    trackGroup={selectedAlbum}
                    size={36}
                    style={{ marginHorizontal: 8 }}
                  />
                  <DownloadAlbumButton album={selectedAlbum} size={36} />
                  <MemoizedAlbumPlayButton />
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={styles.footerSection}>
              <Text style={styles.aboutHeader}>
                {t("trackGroupDetails.about")}
              </Text>
              <Text style={styles.releaseDateText}>
                {formatUTCDate(selectedAlbum?.releaseDate)}
              </Text>

              {selectedAlbum?.about ? (
                <View style={styles.aboutBody}>
                  <Markdown
                    style={{
                      body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
                      link: { color: theme.colors.textCyan },
                    }}
                  >
                    {linkifyUrls(
                      selectedAlbum.about.replace(/([^\n])\n([^\n])/g, "$1 $2"),
                    )}
                  </Markdown>
                </View>
              ) : null}

              <View style={styles.tagWrap}>
                {selectedAlbum.tags?.map((tagName: string, index: number) => (
                  <TagPill key={index} tagName={tagName} />
                ))}
              </View>
            </View>
          )}
        />
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setModalVisible(!modalVisible)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Pressable
                style={styles.purchaseBtn}
                onPress={() => handleExternalPurchase(selectedAlbum)}
              >
                <Text style={styles.purchaseBtnText}>Purchase Info</Text>
                <Ionicons name="open-outline" color="#070b14" size={18} />
              </Pressable>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(!modalVisible)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 16,
    paddingTop: 12,
  },
  coverWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  albumMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaTitles: {
    flex: 1,
    marginRight: 12,
  },
  albumMainTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  artistNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  byText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  artistLink: {
    color: theme.colors.textCyan,
    fontSize: 14,
    fontWeight: "600",
  },
  albumActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  albumPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  footerSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
  aboutHeader: {
    ...theme.typography.sectionHeader,
    fontSize: 13,
    marginBottom: 4,
  },
  releaseDateText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 14,
  },
  aboutBody: {
    marginBottom: 16,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalCard: {
    width: "85%",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  purchaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    gap: 8,
  },
  purchaseBtnText: {
    color: "#070b14",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCloseBtn: {
    marginTop: 20,
    padding: 8,
  },
  modalCloseText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
});
