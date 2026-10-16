import { queryAlbum, queryTrackGroups } from "@/queries/queries";
import { fairplayerReleaseSlug } from "@/queries/fairplayer";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Pressable,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, useRouter } from "expo-router";
import PlayPauseWrapper from "@/components/PlayPauseWrapper";
import TrackPlayer, { PlaybackState, State } from "react-native-track-player";
import { usePlayer } from "@/state/PlayerContext";
import { API_KEY } from "@/constants/api-key";
import { API_ROOT } from "@/constants/api-root";
import { audioTrackType } from "@/scripts/utils";
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import FavoriteTrackButton from "@/components/FavoriteTrackButton";
import AddToQueueButton from "@/components/AddToQueueButton";
import ErrorNotification from "@/components/ErrorNotification";
import LoadingScreen from "@/components/LoadingScreen";

import { theme } from "@/constants/theme";

type DateTimeFormatOptions = Intl.DateTimeFormatOptions;

export default function TrackView() {
  const { slug, id, trackId } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (id && slug) {
      router.replace(`/artist/${id}/album/${slug}/album-tracks`);
    }
  }, [id, slug, router]);

  const { data, isPending, isError, error } = useQuery(
    queryAlbum({ slug: slug, id: id }),
  );
  const { playableTracks, setPlayableTracks } = usePlayer();
  const [album, setAlbum] = useState<RNTrack[]>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [showError, setShowError] = useState<boolean>(true);

  useFocusEffect(
    useCallback(() => {
      if (data) {
        const filteredTrack = data.result.tracks?.find(
          (track) => track.id === Number(trackId),
        );

        if (filteredTrack) {
          filteredTrack.trackGroup = {
            userTrackGroupPurchases: data.result.userTrackGroupPurchases,
            artistId: data.result.artistId,
            urlSlug: data.result.urlSlug,
            cover: data.result.cover,
            title: data.result.title,
            artist: data.result.artist,
            id: data.result.trackGroupId,
            releaseDate: data.result.releaseDate,
            trackGroupId: data.result.trackGroupId,
          };
          filteredTrack.artist = data.result.artist.name;
          filteredTrack.artwork = data.result.cover.sizes[600];
          filteredTrack.url = `${API_ROOT}${filteredTrack.audio.url}`;
          filteredTrack.queueIndex = 0; //Only displaying 1 track on this screen
          filteredTrack.trackGroupId = data.result.trackGroupId;
          filteredTrack.audio = {
            url: filteredTrack.audio.url,
            duration: filteredTrack.audio.duration,
          };
          filteredTrack.headers = {
            "mirlo-api-key": API_KEY,
          };
          filteredTrack.type = audioTrackType(filteredTrack.audio.url);

          setPlayableTracks([filteredTrack]);
          setAlbum([filteredTrack]);
        }
      }
    }, [data]),
  );

  if (isPending) {
    return (
      <LoadingScreen />
    );
  }

  if (isError) {
    console.error(error);
    return (
      <View style={{ flex: 1 }}>
        <ErrorNotification
          visible={showError}
          onDismiss={() => setShowError(false)}
          error={error}
        />
      </View>
    );
  }

  const filteredTrack = data.result.tracks?.find(
    (track) => track.id === Number(trackId),
  );

  if (!filteredTrack) {
    router.dismissTo(`/artist/${id}/album/${slug}/album-tracks`);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 10,
          width: "100%",
          height: 60,
          backgroundColor: "#fafafa",
        }}
      >
        <Pressable onPress={() => router.dismiss()}>
          <Ionicons
            name="chevron-back-outline"
            size={40}
            style={{ color: "#696969" }}
          ></Ionicons>
        </Pressable>
      </View>
      <View style={styles.container}>
        <FlatList
          style={{ width: "100%" }}
          contentContainerStyle={styles.listContainer}
          data={album}
          keyExtractor={(item, index) => `${index}-${item.id || item.title}`}
          renderItem={({ item }) =>
            data.result ? (
              <PlayPauseWrapper
                trackObject={item}
                onTrackScreen={true}
              ></PlayPauseWrapper>
            ) : null
          }
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: data.result?.cover?.sizes[600] }}
                style={[styles.image, { width: width }]}
                resizeMode="cover"
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginVertical: 10,
                }}
              >
                <View style={{ maxWidth: "65%" }}>
                  <Link
                    href={{
                      pathname: "/artist/[id]/album/[slug]/album-tracks",
                      params: {
                        id:
                          fairplayerReleaseSlug.artistRouteId(
                            String(data.result?.urlSlug || ""),
                          ) ?? data.result?.artistId,
                        slug: data.result?.urlSlug,
                      },
                    }}
                    style={{
                      color: "#BE3455",
                      marginBottom: 5,
                      fontWeight: "bold",
                    }}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {data.result?.title}
                  </Link>
                  <Text>
                    {t("profile.albumLink")
                      .replace(/<[^>]*>.*?<\/[^>]*>/g, "")
                      .trim() + " "}
                    <Link
                      href={{
                        pathname: "/artist/[id]/artist-page",
                        params: {
                          id: fairplayerReleaseSlug.artistPageRouteId(data.result),
                        },
                      }}
                      style={{ color: "#BE3455", fontWeight: "bold" }}
                    >
                      {data.result?.artist.name}
                    </Link>
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  {filteredTrack && (
                    <>
                      <AddToQueueButton track={filteredTrack} album={data.result} size={36} />
                      <FavoriteTrackButton track={filteredTrack} size={36} />
                    </>
                  )}
                  <TrackPlayButton />
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={{ marginVertical: 10 }}>
              <Text
                style={{
                  fontWeight: "bold",
                  fontSize: 20,
                  marginBottom: 15,
                }}
              >
                {t("trackGroupDetails.about")}
              </Text>
              <Text style={{ fontStyle: "italic", marginBottom: 20 }}>
                {formatUTCDate(data.result?.releaseDate, t)}
              </Text>
              <Text style={{ marginBottom: 20 }}>{data.result?.about}</Text>
            </View>
          )}
        ></FlatList>
      </View>
    </SafeAreaView>
  );
}

function TrackPlayButton() {
  const {
    isPlaying,
    activeTrack,
    playableTracks,
    playTrack,
    togglePlayPause,
  } = usePlayer();

  const isCurrentTrack = Boolean(
    activeTrack &&
      playableTracks.length > 0 &&
      activeTrack.url === playableTracks[0]?.url,
  );

  const togglePlayback = useCallback(async () => {
    if (!playableTracks.length) return;
    if (isCurrentTrack) {
      await togglePlayPause();
    } else {
      await playTrack(playableTracks[0], playableTracks);
    }
  }, [isCurrentTrack, playableTracks, playTrack, togglePlayPause]);

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      disabled={!playableTracks.length}
      accessibilityRole="button"
      accessibilityLabel={isCurrentTrack && isPlaying ? "Pause Track" : "Play Track"}
    >
      <Ionicons
        name={
          playableTracks.length
            ? isCurrentTrack && isPlaying
              ? "pause-circle-outline"
              : "play-circle-outline"
            : "play-circle-outline"
        }
        size={70}
        style={{ marginHorizontal: 5 }}
        color={playableTracks.length ? "black" : "lightgrey"}
      />
    </TouchableOpacity>
  );
}

function formatUTCDate(utcDate: string | undefined, t: (key: string) => string) {
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
    ? `${t("trackGroupCard.releaseDate").trim()} ${result}`
    : t("trackGroupCard.released").substring(
        0,
        t("trackGroupCard.released").indexOf(":") + 1,
      ) + ` ${result}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "flex-start",
    justifyContent: "space-evenly",
  },
  listContainer: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: "5%",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    justifyContent: "space-between",
    marginVertical: 5,
  },
  listHeader: {
    alignContent: "center",
  },
  text: {
    padding: 10,
    fontWeight: "bold",
  },
  image: {
    height: 380,
    backgroundColor: "#f0f0f0", // placeholder color while loading
    alignSelf: "center",
  },
});
