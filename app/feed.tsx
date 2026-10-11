import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  PanResponder,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer, QueueSlot } from "@/state/PlayerContext";
import { theme } from "@/constants/theme";
import { AUTOPLAY_SOURCE } from "@/scripts/autoplay";
import ShuffleButton from "@/components/ShuffleButton";
import LoopButton from "@/components/LoopButton";

type Layout = { y: number; height: number };
type DragState = { from: QueueSlot; dy: number; target: QueueSlot; indicatorY: number };

const slotKey = (slot: QueueSlot) => `${slot.section}:${slot.index}`;

type QueueRowProps = {
  track: RNTrack;
  slot: QueueSlot;
  dragging: boolean;
  dy: number;
  onPress: () => void;
  onLayout: (slot: QueueSlot, e: LayoutChangeEvent) => void;
  onDragStart: (slot: QueueSlot) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
};

function QueueRow({
  track,
  slot,
  dragging,
  dy,
  onPress,
  onLayout,
  onDragStart,
  onDragMove,
  onDragEnd,
}: QueueRowProps) {
  // Handlers come from stable callbacks in the parent, so the responder is created once per row
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => onDragStart(slotRef.current),
      onPanResponderMove: (_e, g) => onDragMove(g.dy),
      onPanResponderRelease: () => onDragEnd(),
      onPanResponderTerminate: () => onDragEnd(),
    }),
  ).current;

  const artwork =
    track.artwork ||
    track.trackGroup?.cover?.sizes?.[300] ||
    track.trackGroup?.cover?.sizes?.[120];
  const isExplicit = (track as any).isExplicit || (track as any).explicit;

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => onLayout(slot, e)}
      style={[
        styles.trackRow,
        dragging && [styles.trackRowDragging, { transform: [{ translateY: dy }] }],
      ]}
    >
      <View style={styles.trackThumbWrapper}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.trackThumb} />
        ) : (
          <View style={[styles.trackThumb, styles.thumbPlaceholder]}>
            <Ionicons name="musical-notes" size={16} color={theme.colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <View style={styles.artistRow}>
          {isExplicit && (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          )}
          <Text style={styles.trackArtist} numberOfLines={1}>
            {track.artist || track.trackGroup?.artist?.name || ""}
          </Text>
        </View>
      </View>

      <View
        {...responder.panHandlers}
        style={styles.reorderHandle}
        accessibilityLabel={`Drag to reorder ${track.title}`}
      >
        <Ionicons
          name="reorder-three"
          size={24}
          color={dragging ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

export default function QueueScreen() {
  const router = useRouter();
  const {
    activeTrack,
    queueSource,
    userQueue,
    upcoming: upcomingTracks,
    clearUserQueue,
    removeFromUserQueue,
    moveQueueItem,
    playFromUserQueue,
    skipToUpcoming,
  } = usePlayer();

  const [activeMenu, setActiveMenu] = useState<{
    visible: boolean;
    track?: RNTrack;
    isQueueHeader?: boolean;
    queueIndex?: number;
  }>({ visible: false });


  // Once playback has moved into autoplay, every upcoming track is from recent releases
  const nextUpSource = activeTrack?.autoplay ? AUTOPLAY_SOURCE : queueSource;
  const firstAutoplayIndex = activeTrack?.autoplay
    ? -1
    : upcomingTracks.findIndex((t) => t.autoplay);

  const currentArtwork =
    activeTrack?.artwork ||
    activeTrack?.trackGroup?.cover?.sizes?.[300] ||
    activeTrack?.trackGroup?.cover?.sizes?.[600];

  // ---- Drag and drop ----
  const rowLayouts = useRef<Record<string, Layout>>({});
  const queueEmptyLayout = useRef<Layout | null>(null);
  const nextUpHeaderLayout = useRef<Layout | null>(null);
  const counts = useRef({ queue: 0, upcoming: 0 });
  counts.current = { queue: userQueue.length, upcoming: upcomingTracks.length };
  const moveRef = useRef(moveQueueItem);
  moveRef.current = moveQueueItem;
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const onRowLayout = useCallback((slot: QueueSlot, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    rowLayouts.current[slotKey(slot)] = { y, height };
  }, []);

  // Finds where the dragged row would land, and where to draw the drop line
  const computeTarget = (from: QueueSlot, dy: number) => {
    const fromLayout = rowLayouts.current[slotKey(from)];
    const fingerY = (fromLayout?.y ?? 0) + (fromLayout?.height ?? 0) / 2 + dy;
    const header = nextUpHeaderLayout.current;
    const section: QueueSlot["section"] =
      header && counts.current.upcoming > 0 && fingerY >= header.y ? "upcoming" : "queue";

    const rows: Layout[] = [];
    for (let i = 0; i < counts.current[section]; i++) {
      if (section === from.section && i === from.index) continue;
      const layout = rowLayouts.current[slotKey({ section, index: i })];
      if (layout) rows.push(layout);
    }

    const index = rows.filter((r) => r.y + r.height / 2 < fingerY).length;
    let indicatorY: number;
    if (index < rows.length) {
      indicatorY = rows[index].y;
    } else if (rows.length > 0) {
      const last = rows[rows.length - 1];
      indicatorY = last.y + last.height;
    } else if (section === "queue") {
      const empty = queueEmptyLayout.current;
      indicatorY = empty ? empty.y + empty.height / 2 : 0;
    } else {
      indicatorY = header ? header.y + header.height : 0;
    }
    return { target: { section, index }, indicatorY };
  };

  const onDragStart = useCallback((slot: QueueSlot) => {
    const next = { from: slot, dy: 0, ...computeTarget(slot, 0) };
    dragRef.current = next;
    setDrag(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragMove = useCallback((dy: number) => {
    const current = dragRef.current;
    if (!current) return;
    const next = { from: current.from, dy, ...computeTarget(current.from, dy) };
    dragRef.current = next;
    setDrag(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragEnd = useCallback(() => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (current) moveRef.current(current.from, current.target);
  }, []);

  const isDragging = (slot: QueueSlot) =>
    drag?.from.section === slot.section && drag.from.index === slot.index;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!drag}
      >
        {/* Currently Playing Card */}
        {activeTrack ? (
          <View style={styles.nowPlayingCard}>
            <View style={styles.cardThumbWrapper}>
              {currentArtwork ? (
                <Image source={{ uri: currentArtwork }} style={styles.cardThumb} />
              ) : (
                <View style={[styles.cardThumb, styles.thumbPlaceholder]}>
                  <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
                </View>
              )}
            </View>

            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {activeTrack.title}
              </Text>
              <Text style={styles.cardArtist} numberOfLines={1}>
                {activeTrack.artist || activeTrack.trackGroup?.artist?.name || "Mirlo"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                setActiveMenu({
                  visible: true,
                  track: activeTrack,
                })
              }
              style={styles.optionsButton}
              accessibilityRole="button"
              accessibilityLabel="Track Options"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nowPlayingCard}>
            <View style={[styles.cardThumb, styles.thumbPlaceholder]}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.textMuted} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Nothing Playing</Text>
              <Text style={styles.cardArtist}>Play a track to start listening</Text>
            </View>
          </View>
        )}

        {/* Section: Your Queue */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Queue</Text>
          {userQueue.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                setActiveMenu({
                  visible: true,
                  isQueueHeader: true,
                })
              }
              style={styles.optionsButton}
              accessibilityRole="button"
              accessibilityLabel="Queue Options"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {userQueue.length > 0 ? (
          userQueue.map((track, idx) => {
            const slot: QueueSlot = { section: "queue", index: idx };
            return (
              <QueueRow
                key={`user-queue-${track.id ?? idx}-${idx}`}
                track={track}
                slot={slot}
                dragging={isDragging(slot)}
                dy={drag?.dy ?? 0}
                onPress={() => playFromUserQueue(idx)}
                onLayout={onRowLayout}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            );
          })
        ) : (
          <View
            style={[
              styles.emptyQueuePrompt,
              drag?.target.section === "queue" && styles.emptyQueueDropActive,
            ]}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              queueEmptyLayout.current = { y, height };
            }}
          >
            <Text style={styles.emptyQueueText}>
              {drag ? "Drop here to queue" : "No manually queued songs"}
            </Text>
          </View>
        )}

        {/* Section: Next Up from the loaded playlist */}
        {upcomingTracks.length > 0 && (
          <View
            style={[styles.sectionHeaderRow, styles.nextUpHeader]}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              nextUpHeaderLayout.current = { y, height };
            }}
          >
            <Text style={[styles.sectionTitle, styles.nextUpTitle]} numberOfLines={1}>
              {nextUpSource ? `Next Up from: ${nextUpSource}` : "Next Up"}
            </Text>
            <View style={styles.modeButtons}>
              <ShuffleButton />
              <LoopButton />
            </View>
          </View>
        )}

        {upcomingTracks.map((track, idx) => {
          const slot: QueueSlot = { section: "upcoming", index: idx };
          return (
            <React.Fragment key={`upcoming-${track.id ?? idx}-${idx}`}>
              {idx === firstAutoplayIndex && (
                <View style={styles.autoplayDivider}>
                  <Ionicons name="radio-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.autoplayDividerText}>
                    Then: {AUTOPLAY_SOURCE}
                  </Text>
                </View>
              )}
              <QueueRow
                track={track}
                slot={slot}
                dragging={isDragging(slot)}
                dy={drag?.dy ?? 0}
                onPress={() => skipToUpcoming(idx)}
                onLayout={onRowLayout}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            </React.Fragment>
          );
        })}

        {/* Drop position line */}
        {drag && !(drag.target.section === "queue" && userQueue.length === 0) && (
          <View style={[styles.dropLine, { top: drag.indicatorY - 1, pointerEvents: "none" }]} />
        )}

        {/* Global Empty State if nothing is playing and queue is completely empty */}
        {!activeTrack && userQueue.length === 0 && upcomingTracks.length === 0 && (
          <View style={styles.fullEmptyContainer}>
            <TouchableOpacity
              onPress={() => router.push("/")}
              style={styles.exploreButton}
              accessibilityRole="button"
              accessibilityLabel="Explore Music"
            >
              <Text style={styles.exploreButtonText}>Explore Mirlo Music</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Options Modal */}
      <Modal
        visible={activeMenu.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveMenu({ visible: false })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActiveMenu({ visible: false })}
        >
          <View style={styles.modalSheet}>
            {activeMenu.isQueueHeader ? (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  clearUserQueue();
                  setActiveMenu({ visible: false });
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#ff5252" />
                <Text style={[styles.modalItemText, { color: "#ff5252" }]}>Clear Queue</Text>
              </TouchableOpacity>
            ) : activeMenu.track ? (
              <>
                {activeMenu.track.trackGroup && (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      const tg = activeMenu.track!.trackGroup;
                      setActiveMenu({ visible: false });
                      if (tg?.artistId && tg?.urlSlug) {
                        router.push({
                          pathname: "/artist/[id]/album/[slug]/album-tracks",
                          params: {
                            id: String(tg.artistId),
                            slug: String(tg.urlSlug),
                          },
                        });
                      }
                    }}
                  >
                    <Ionicons name="disc-outline" size={20} color={theme.colors.textPrimary} />
                    <Text style={styles.modalItemText}>View Album</Text>
                  </TouchableOpacity>
                )}
                {activeMenu.queueIndex !== undefined && (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      removeFromUserQueue(activeMenu.queueIndex!);
                      setActiveMenu({ visible: false });
                    }}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color="#ff5252" />
                    <Text style={[styles.modalItemText, { color: "#ff5252" }]}>Remove from Queue</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}

            <TouchableOpacity
              style={[styles.modalItem, styles.modalCloseItem]}
              onPress={() => setActiveMenu({ visible: false })}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  nowPlayingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 16,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    marginBottom: 20,
  },
  cardThumbWrapper: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  cardThumb: {
    width: 52,
    height: 52,
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  cardArtist: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  optionsButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 8,
    borderRadius: theme.radius.sm,
  },
  trackRowDragging: {
    zIndex: 10,
    elevation: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    opacity: 0.95,
  },
  dropLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  trackThumbWrapper: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  trackThumb: {
    width: 46,
    height: 46,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  explicitBadge: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  explicitText: {
    color: "#d0d7de",
    fontSize: 10,
    fontWeight: "800",
  },
  trackArtist: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  reorderHandle: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    // Web: a touch on the handle drags the row instead of panning the page
    ...(Platform.OS === "web" ? ({ touchAction: "none" } as object) : {}),
  },
  emptyQueuePrompt: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  emptyQueueDropActive: {
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
  },
  emptyQueueText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  nextUpHeader: {
    marginTop: 18,
  },
  nextUpTitle: {
    flex: 1,
  },
  modeButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  autoplayDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
  autoplayDividerText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  fullEmptyContainer: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  exploreButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  exploreButtonText: {
    color: theme.colors.playButtonIcon,
    fontWeight: "700",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  modalItemText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  modalCloseItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    justifyContent: "center",
  },
  modalCloseText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
