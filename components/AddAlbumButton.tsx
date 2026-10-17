import { useAuthContext } from "@/state/AuthContext";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { fairplayerReleaseSlug } from "@/queries/fairplayer";
import { openPurchase } from "@/scripts/openPurchase";
import { faircampAction, isFreeAlbum, sellsOnMirlo } from "@/components/purchase/helpers";
import { useClaimFreeAlbum } from "@/queries/listener";
import { ownsAlbum } from "@/scripts/utils";
import { showError } from "@/scripts/showError";
import { theme } from "@/constants/theme";

type AddAlbumButtonProps = {
  trackGroup: AlbumProps;
  style?: ViewStyle;
  size?: number;
};

// Opens the purchase sheet for this release, or claims it immediately if free; hidden once the listener owns it
export default function AddAlbumButton({ style, size = 32, trackGroup }: AddAlbumButtonProps) {
  const { user } = useAuthContext();
  const router = useRouter();
  const { mutate: claimFree, isPending } = useClaimFreeAlbum();

  const isFree = sellsOnMirlo(trackGroup) && isFreeAlbum(trackGroup);
  const owned = ownsAlbum(user, trackGroup);
  const faircamp = faircampAction(trackGroup);

  const onPress = useCallback(() => {
    if (isPending) return;

    if (isFree) {
      if (!user) {
        router.push("/login");
        return;
      }
      claimFree(trackGroup, {
        onError: showError("Could not add album to collection"),
      });
      return;
    }

    openPurchase(router, {
      kind: "album",
      artist:
        fairplayerReleaseSlug.artistRouteId(trackGroup.urlSlug) ??
        String(trackGroup.artist?.urlSlug || trackGroup.artistId),
      slug: trackGroup.urlSlug,
    });
  }, [isPending, isFree, user, claimFree, trackGroup, router]);

  return owned || faircamp === "download" || faircamp === "none" ? null : (
    <Pressable
      onPress={onPress}
      disabled={isPending}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={
        isPending
          ? "Adding album to collection"
          : isFree
            ? "Add free album to collection"
            : "Purchase album"
      }
    >
      {isPending ? (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <Ionicons name="bag-handle-outline" size={size} color="#ababab" />
      )}
    </Pressable>
  );
}
