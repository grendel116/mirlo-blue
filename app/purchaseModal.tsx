import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
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

// The one purchase sheet: an album, an artist's whole catalogue, or support for an artist.
// Opened with openPurchase; `artist` is the artist route id the album and artist pages use
export default function PurchaseModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind: PurchaseTarget["kind"];
    artist: string;
    slug?: string;
  }>();
  const [kind, setKind] = useState(params.kind);
  const checkout = useCheckout();
  const { stage, request } = checkout;

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
          onDone={() => router.dismiss()}
        />
      );
    }
    return chooseView();
  };

  return (
    <SafeAreaView style={styles.container}>
      <DismissModalBar />
      {stage.name === "pay" ? (
        <PayStage checkoutUrl={stage.checkoutUrl} onPaid={checkout.confirm} onCancel={checkout.cancel} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>{stageView()}</Card>
        </ScrollView>
      )}
    </SafeAreaView>
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
