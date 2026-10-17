import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import DismissModalBar from "@/components/DismissModalBar";
import { theme } from "@/constants/theme";
import { queryAlbum, queryArtist } from "@/queries/queries";
import { queryCatalogPrice, queryPaymentsEnabled } from "@/queries/listener";
import type { PurchaseTarget } from "@/scripts/openPurchase";
import { albumCurrency, artistCurrency, sellsOnMirlo } from "@/components/purchase/helpers";
import { useCheckout, type CheckoutControls } from "@/components/purchase/useCheckout";
import { AlbumPurchase } from "@/components/purchase/AlbumPurchase";
import { CataloguePurchase } from "@/components/purchase/CataloguePurchase";
import { SupportPurchase } from "@/components/purchase/SupportPurchase";
import { PayStage } from "@/components/purchase/PayStage";
import { Confirming, Done } from "@/components/purchase/CheckoutResult";
import {
  Card,
  LoadError,
  Loading,
  PaymentsGate,
  type PaymentsStatus,
} from "@/components/purchase/ui";

const SETTLE_MS = 220;
const FLICK_VELOCITY = 600;

// The one purchase sheet: an album, an artist's whole catalogue, or support for an artist.
// Opened with openPurchase; `artist` is the artist route id the album and artist pages use
export default function PurchaseModal() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const heightSv = useSharedValue(windowHeight);
  const scrollOffset = useSharedValue(0);
  const startedAtTop = useSharedValue(true);
  const closingRef = useRef(false);

  useEffect(() => {
    heightSv.value = windowHeight;
  }, [windowHeight, heightSv]);

  const dismiss = useCallback(() => {
    if (router.canDismiss()) router.dismiss();
    else router.replace("/");
  }, [router]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    translateY.value = withTiming(heightSv.value, { duration: SETTLE_MS }, (finished) => {
      if (finished) runOnJS(dismiss)();
    });
  }, [translateY, heightSv, dismiss]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffset.value = event.contentOffset.y;
  });

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  // Drag down to close the purchase/support sheet when scrolled to the top
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-16, 16])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          startedAtTop.value = scrollOffset.value <= 0;
        })
        .onUpdate((event) => {
          if (!startedAtTop.value) return;
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (!startedAtTop.value) return;
          const shouldClose =
            event.velocityY > FLICK_VELOCITY ||
            (event.velocityY > -FLICK_VELOCITY && translateY.value > heightSv.value * 0.25);
          translateY.value = withTiming(
            shouldClose ? heightSv.value : 0,
            { duration: SETTLE_MS },
            (finished) => {
              if (finished && shouldClose) runOnJS(dismiss)();
            },
          );
        }),
    [scrollGesture, scrollOffset, startedAtTop, translateY, heightSv, dismiss],
  );

  const headerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-16, 16])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldClose =
            event.velocityY > FLICK_VELOCITY ||
            (event.velocityY > -FLICK_VELOCITY && translateY.value > heightSv.value * 0.25);
          translateY.value = withTiming(
            shouldClose ? heightSv.value : 0,
            { duration: SETTLE_MS },
            (finished) => {
              if (finished && shouldClose) runOnJS(dismiss)();
            },
          );
        }),
    [translateY, heightSv, dismiss],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const params = useLocalSearchParams<{
    kind: PurchaseTarget["kind"];
    artist: string;
    slug?: string;
  }>();
  const [kind, setKind] = useState(params.kind);
  const checkout = useCheckout();
  const { stage, request } = checkout;

  useEffect(() => {
    closingRef.current = false;
    translateY.value = 0;
    setKind(params.kind);
  }, [params.kind, params.artist, params.slug, translateY]);

  const albumQuery = useQuery(queryAlbum({ slug: params.slug ?? "", id: params.artist }));
  const album = albumQuery.data?.result;
  // Releases from other sources link to their own stores and need no Mirlo artist
  const needsArtist = kind !== "album" || (album !== undefined && sellsOnMirlo(album));
  const artistQuery = useQuery(queryArtist({ artistSlug: needsArtist ? params.artist : "" }));
  const artist = artistQuery.data;
  const paymentsQuery = useQuery(queryPaymentsEnabled(artist));
  const catalogQuery = useQuery(queryCatalogPrice(artist?.id, kind === "catalogue"));

  const payments: PaymentsStatus =
    artistQuery.isError || paymentsQuery.isError
      ? "error"
      : paymentsQuery.data === undefined
        ? "loading"
        : paymentsQuery.data
          ? "enabled"
          : "disabled";

  const controls: CheckoutControls = {
    onPay: checkout.pay,
    busy: checkout.busy,
    error: checkout.error,
  };

  const chooseView = () => {
    if (kind === "album") {
      if (albumQuery.isError) return <LoadError />;
      if (!album) return <Loading />;
      return (
        <AlbumPurchase
          album={album}
          currency={albumCurrency(album, artist ?? album.artist)}
          payments={payments}
          onSupport={() => setKind("support")}
          {...controls}
        />
      );
    }
    if (artistQuery.isError) return <LoadError />;
    if (!artist) return <Loading />;
    return (
      <PaymentsGate status={payments} artistName={artist.name}>
        {kind === "catalogue" ? (
          catalogQuery.isError ? (
            <LoadError />
          ) : catalogQuery.data === undefined ? (
            <Loading />
          ) : (
            <CataloguePurchase
              artist={artist}
              currency={artistCurrency(artist)}
              price={catalogQuery.data}
              {...controls}
            />
          )
        ) : (
          <SupportPurchase
            artist={artist}
            currency={artistCurrency(artist)}
            album={album}
            onBuyAlbum={album ? () => setKind("album") : undefined}
            {...controls}
          />
        )}
      </PaymentsGate>
    );
  };

  const stageView = () => {
    if (stage.name === "confirming") return <Confirming />;
    if (stage.name === "done" && request) {
      const purchaseType = request.items[0].type;
      const forAlbum = purchaseType === "trackGroup";
      return (
        <Done
          outcome={stage.outcome}
          purchaseType={purchaseType}
          artistName={(forAlbum ? album?.artist?.name : artist?.name) ?? "the artist"}
          album={forAlbum ? album : undefined}
          email={request.guestEmail}
          onDone={close}
        />
      );
    }
    return chooseView();
  };

  return (
    <Animated.View style={[styles.container, sheetStyle]}>
      {stage.name === "pay" ? (
        <SafeAreaView edges={["top"]} style={styles.container}>
          <GestureDetector gesture={headerPanGesture}>
            <DismissModalBar onPress={close} />
          </GestureDetector>
          <PayStage
            checkoutUrl={stage.checkoutUrl}
            onPaid={checkout.confirm}
            onCancel={checkout.cancel}
          />
        </SafeAreaView>
      ) : (
        <GestureDetector gesture={panGesture}>
          <SafeAreaView edges={["top"]} style={styles.container}>
            <DismissModalBar onPress={close} />
            <GestureDetector gesture={scrollGesture}>
              <Animated.ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
              >
                <Card>{stageView()}</Card>
              </Animated.ScrollView>
            </GestureDetector>
          </SafeAreaView>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
});
