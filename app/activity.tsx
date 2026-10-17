import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Markdown from "react-native-markdown-display";
import { useAuthContext } from "@/state/AuthContext";
import { queryUserPurchases } from "@/queries/queries";
import {
  formatMoney,
  queryFollowingFeed,
  queryUnreadCount,
  useMarkAllRead,
} from "@/queries/listener";
import { htmlToMarkdown, resolveArtworkUrl } from "@/scripts/utils";
import { openInBrowser } from "@/scripts/openInBrowser";
import { theme } from "@/constants/theme";
import { albumCover, albumPageHref } from "@/app/library";

type ActivityPill = "following" | "you";

const PILLS: { id: ActivityPill; label: string }[] = [
  { id: "following", label: "Following" },
  { id: "you", label: "You" },
];

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const artistAvatar = (artist?: Artist) =>
  resolveArtworkUrl(
    artist?.avatar?.sizes?.[120] || artist?.avatar?.sizes?.[300] || artist?.avatar?.url,
  );

export type PurchasedItem = {
  key: string;
  title: string;
  subtitle: string;
  cover: string;
  // The release a bought album or song belongs to, which the row opens
  trackGroup?: any;
};

// Everything bought in one Mirlo transaction: albums, then songs, then merch
export function transactionItems(transaction: any): PurchasedItem[] {
  const albums = (transaction?.trackGroupPurchases ?? []).map((p: any) => ({
    key: `album-${p.trackGroupId}`,
    title: p.trackGroup?.title ?? "Album",
    subtitle: p.trackGroup?.artist?.name ?? "",
    cover: albumCover(p.trackGroup),
    trackGroup: p.trackGroup,
  }));
  const songs = (transaction?.trackPurchases ?? []).map((p: any) => {
    const trackGroup = p.track?.trackGroup;
    return {
      key: `track-${p.trackId}`,
      title: p.track?.title ?? "Song",
      subtitle: [trackGroup?.artist?.name, trackGroup?.title].filter(Boolean).join(" · "),
      cover: albumCover(trackGroup),
      trackGroup,
    };
  });
  const merch = (transaction?.merchPurchases ?? []).map((p: any, index: number) => {
    const image = p.merch?.images?.[0];
    return {
      key: `merch-${p.id ?? index}`,
      title: p.merch?.title ?? "Merch",
      subtitle: p.merch?.artist?.name ?? "Merch",
      cover: resolveArtworkUrl(image?.sizes?.[120] || image?.sizes?.[300] || image?.url),
    };
  });
  return [...albums, ...songs, ...merch];
}

export default function ActivityScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [pill, setPill] = useState<ActivityPill>("following");
  const userId = user?.id;

  // Opening Your Activity marks every notification read, which clears the bell's badge
  const { data: unreadCount } = useQuery(queryUnreadCount(userId));
  const { mutate: markAllRead } = useMarkAllRead(userId);
  useEffect(() => {
    if (unreadCount) markAllRead();
  }, [unreadCount, markAllRead]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.topNav}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Your Activity</Text>
      </View>

      <View style={styles.pillRow}>
        {PILLS.map(({ id, label }) => {
          const active = pill === id;
          return (
            <Pressable
              key={id}
              onPress={() => setPill(id)}
              style={({ pressed }) => [
                styles.pill,
                active && styles.pillActive,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {!userId ? (
          <View style={styles.centered}>
            <Ionicons name="lock-closed-outline" size={48} color={theme.colors.primary} />
            <Text style={styles.centeredTitle}>Sign in to see your activity</Text>
            <Text style={styles.centeredSubtitle}>
              New releases and posts from artists you follow, and everything you've bought.
            </Text>
            <TouchableOpacity onPress={() => router.push("/login")} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : pill === "following" ? (
          <FollowingFeed userId={userId} />
        ) : (
          <PurchaseHistory userId={userId} />
        )}
      </View>
    </SafeAreaView>
  );
}

function FollowingFeed({ userId }: { userId: number }) {
  const router = useRouter();
  const { data, isPending } = useQuery(queryFollowingFeed(userId));
  const notifications = data?.results ?? [];

  if (isPending) {
    return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />;
  }
  if (notifications.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
        <Text style={styles.centeredTitle}>Nothing here yet</Text>
        <Text style={styles.centeredSubtitle}>
          Follow artists from their pages to see their new releases and posts here.
        </Text>
        <TouchableOpacity onPress={() => router.push("/search")} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Find Artists</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <FlatList
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) =>
        item.trackGroup ? <ReleaseCard notification={item} /> : <PostCard notification={item} />
      }
    />
  );
}

// A new release or pre-order: cover, title, artist and date; tapping opens the album page
function ReleaseCard({ notification }: { notification: MirloNotification }) {
  const router = useRouter();
  const trackGroup = { ...notification.trackGroup, artist: notification.trackGroup?.artist ?? notification.artist };
  const isPreorder = notification.notificationType === "NEW_ARTIST_PREORDER";
  const coverUri = albumCover(trackGroup);
  return (
    <Pressable
      android_ripple={{ color: theme.colors.ripple }}
      onPress={() => {
        const href = albumPageHref(trackGroup);
        if (href) router.push(href);
      }}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.cardPressed]}
    >
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.placeholder]}>
          <Ionicons name="albums" size={22} color={theme.colors.primary} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.kicker}>{isPreorder ? "PRE-ORDER" : "NEW RELEASE"}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {trackGroup.title}
        </Text>
        <Text style={styles.cardArtist} numberOfLines={1}>
          {trackGroup.artist?.name}
        </Text>
        <MetaDate date={notification.createdAt} unread={!notification.isRead} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

// A post: the artist, title, date and the opening lines; tapping reads the whole post here.
// Posts for subscribers open the artist's page, where the listener can subscribe
function PostCard({ notification }: { notification: MirloNotification }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const post = notification.post;
  const artist = notification.artist ?? post?.artist;
  const avatarUri = artistAvatar(artist);
  const isHidden = Boolean(post?.isContentHidden);

  const onPress = () => {
    if (!isHidden) {
      setExpanded((open) => !open);
    } else if (artist) {
      router.push({
        pathname: "/artist/[id]/artist-page",
        params: { id: artist.urlSlug ?? String(artist.id) },
      });
    }
  };

  return (
    <Pressable
      android_ripple={{ color: theme.colors.ripple }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.row}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Ionicons name="person" size={16} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardArtist} numberOfLines={1}>
            {artist?.name}
          </Text>
          <MetaDate date={post?.publishedAt ?? notification.createdAt} unread={!notification.isRead} />
        </View>
      </View>

      <Text style={styles.postTitle}>{post?.title}</Text>

      {isHidden ? (
        <View style={styles.hiddenNote}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.hiddenText}>This post is for subscribers</Text>
        </View>
      ) : (
        <>
          {expanded && post?.featuredImage?.src ? (
            <Image
              source={{ uri: resolveArtworkUrl(post.featuredImage.src) }}
              style={styles.featuredImage}
              resizeMode="cover"
            />
          ) : null}
          <View style={expanded ? undefined : styles.excerpt}>
            <Markdown
              onLinkPress={(url) => {
                openInBrowser(url);
                return false;
              }}
              style={markdownStyles}
            >
              {htmlToMarkdown(post?.content)}
            </Markdown>
          </View>
          <Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text>
        </>
      )}
    </Pressable>
  );
}

function MetaDate({ date, unread }: { date: string; unread: boolean }) {
  return (
    <View style={styles.metaRow}>
      {unread ? <View style={styles.unreadDot} /> : null}
      <Text style={styles.metaText}>{formatDate(date)}</Text>
    </View>
  );
}

// The listener's own purchases on Mirlo, newest first
function PurchaseHistory({ userId }: { userId: number }) {
  const router = useRouter();
  const { data, isPending } = useQuery(queryUserPurchases(userId));
  const transactions = data?.results ?? [];

  if (isPending) {
    return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />;
  }
  if (transactions.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
        <Text style={styles.centeredTitle}>No purchases yet</Text>
        <Text style={styles.centeredSubtitle}>
          Albums, songs and merch you buy from artists on Mirlo will appear here.
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={transactions}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item: transaction }) => {
        const items = transactionItems(transaction);
        return (
          <View style={styles.card}>
            <View style={styles.transactionHeader}>
              <Text style={styles.metaText}>{formatDate(transaction.createdAt)}</Text>
              <Text style={styles.total}>
                {transaction.amount
                  ? formatMoney(transaction.amount, transaction.currency)
                  : "Free"}
              </Text>
            </View>
            {items.length === 0 ? (
              <Text style={styles.cardArtist}>Support for an artist</Text>
            ) : (
              items.map((item) => {
                const href = albumPageHref(item.trackGroup);
                return (
                  <Pressable
                    key={item.key}
                    disabled={!href}
                    onPress={() => href && router.push(href)}
                    style={({ pressed }) => [styles.row, styles.itemRow, pressed && { opacity: 0.7 }]}
                  >
                    {item.cover ? (
                      <Image source={{ uri: item.cover }} style={styles.smallCover} />
                    ) : (
                      <View style={[styles.smallCover, styles.placeholder]}>
                        <Ionicons name="pricetag" size={14} color={theme.colors.primary} />
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        );
      }}
    />
  );
}

const markdownStyles = {
  body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  link: { color: theme.colors.textCyan },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
  },
  backBtn: {
    padding: 6,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 20,
    fontWeight: "normal",
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  pillTextActive: {
    color: theme.colors.playButtonIcon,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  cardPressed: {
    opacity: 0.75,
    backgroundColor: theme.colors.surfaceElevated,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceElevated,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceElevated,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  kicker: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  cardArtist: {
    color: theme.colors.textCyan,
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.notificationDot,
  },
  postTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  excerpt: {
    maxHeight: 64,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.sm,
    marginVertical: 8,
    backgroundColor: theme.colors.surfaceElevated,
  },
  readMore: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  hiddenNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  hiddenText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  total: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  itemRow: {
    paddingVertical: 6,
  },
  smallCover: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceElevated,
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  itemSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  centeredTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  centeredSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  primaryBtnText: {
    color: theme.colors.playButtonIcon,
    fontWeight: "700",
    fontSize: 14,
  },
});
