import { useAuthContext } from "@/state/AuthContext";
import { Router, useRouter } from "expo-router";
import { Pressable, ViewStyle, Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { getLocales } from "expo-localization";

type AddAlbumButtonProps = {
  trackGroup: AlbumProps;
  setModalVisible?: (modalVisible: boolean) => void;
  style?: ViewStyle;
  size?: number;
};

const getAppStoreRegion = () => {
  return getLocales()[0].regionCode;
};

export const showModal = (
  modalPath: string,
  router: Router,
  trackGroup: Partial<AlbumProps> | AlbumProps,
) => {
  router.push({
    pathname: modalPath as any,
    params: {
      trackGroupTitle: trackGroup.title,
      trackGroupId: trackGroup.id,
      artistId: trackGroup.artistId ?? trackGroup.artist?.id,
      artist: trackGroup.artist?.name,
      source: trackGroup.source,
      sourceUrl: trackGroup.sourceUrl,
      purchaseLinks: trackGroup.purchaseLinks
        ? JSON.stringify(trackGroup.purchaseLinks)
        : undefined,
      urlSlug: trackGroup.urlSlug,
      artistUrlSlug: trackGroup.artist?.urlSlug,
    },
  });
};

export const showPurchaseModal = (
  router: Router,
  trackGroup: Partial<AlbumProps> | AlbumProps,
) => {
  showModal("/purchaseModal", router, trackGroup);
};

export default function AddAlbumButton({
  style,
  size,
  trackGroup,
  setModalVisible,
}: AddAlbumButtonProps) {
  const { user } = useAuthContext();
  const router = useRouter();

  const ids: number[] | undefined = user?.userTrackGroupPurchases?.map(
    (purchase) => purchase.trackGroupId,
  );

  const onPress = useCallback(() => {
    const region = getAppStoreRegion();

    // We can just add free albums without worrying about Apple purchase guidelines
    if (user && (trackGroup.minPrice === 0 || trackGroup.minPrice === null)) {
      showModal("/addFreeAlbumModal", router, trackGroup);
      return;
    }

    // Direct purchase modal (slides up from bottom like addFreeAlbumModal)
    if (Platform.OS === "android" || region === "US" || trackGroup.source) {
      showModal("/purchaseModal", router, trackGroup);
    } else {
      // If not in US on iOS, follow email flow to stay within App Store guidelines
      if (!user) {
        showModal("/emailVerificationModal", router, trackGroup);
      } else {
        showModal("/emailPurchaseInfoModal", router, trackGroup);
      }
    }
  }, [user, trackGroup, router]);
  return ids && ids.includes(trackGroup.id) ? null : (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={
        trackGroup.minPrice === 0 || trackGroup.minPrice === null
          ? "Add free album to collection"
          : "Purchase album"
      }
    >
      <Ionicons name="bag-handle-outline" size={size} color="#ababab" />
    </Pressable>
  );
}
