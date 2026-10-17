import { useAuthContext } from "@/state/AuthContext";
import { useRouter } from "expo-router";
import { Pressable, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { fairplayerReleaseSlug } from "@/queries/fairplayer";
import { openPurchase } from "@/scripts/openPurchase";
import { isFreeAlbum, sellsOnMirlo } from "@/components/purchase/helpers";
import { useFaircampShop } from "@/components/purchase/useFaircampShop";

type AddAlbumButtonProps = {
  trackGroup: AlbumProps;
  style?: ViewStyle;
  size?: number;
};

// Opens the purchase sheet for this release; hidden once the listener owns it
export default function AddAlbumButton({ style, size, trackGroup }: AddAlbumButtonProps) {
  const { user } = useAuthContext();
  const router = useRouter();

  const ids: number[] | undefined = user?.userTrackGroupPurchases?.map(
    (purchase) => purchase.trackGroupId,
  );

  const onPress = useCallback(() => {
    openPurchase(router, {
      kind: "album",
      artist:
        fairplayerReleaseSlug.artistRouteId(trackGroup.urlSlug) ??
        String(trackGroup.artist?.urlSlug || trackGroup.artistId),
      slug: trackGroup.urlSlug,
    });
  }, [trackGroup, router]);

  const owned = ids?.includes(trackGroup.id);
  // Faircamp: shown for paid, code and external downloads, once the check finishes
  const faircamp = useFaircampShop(trackGroup);
  const hidden = faircamp.isFaircamp && (faircamp.pending || !faircamp.shop || faircamp.shop.mode === "free");

  return owned || hidden ? null : (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={
        sellsOnMirlo(trackGroup) && isFreeAlbum(trackGroup)
          ? "Add free album to collection"
          : "Purchase album"
      }
    >
      <Ionicons name="bag-handle-outline" size={size} color="#ababab" />
    </Pressable>
  );
}
