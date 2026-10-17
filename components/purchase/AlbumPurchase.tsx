import { Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuthContext } from "@/state/AuthContext";
import { openInBrowser } from "@/scripts/openInBrowser";
import { FaircampShop } from "./FaircampShop";
import {
  defaultAlbumPrice,
  externalPurchaseLinks,
  isFreeAlbum,
  priceChips,
  sellsOnMirlo,
} from "./helpers";
import { PriceForm } from "./PriceForm";
import type { CheckoutControls } from "./useCheckout";
import {
  AlbumHeader,
  ErrorText,
  Notice,
  PaymentsGate,
  PrimaryButton,
  SecondaryButton,
  styles,
  type PaymentsStatus,
} from "./ui";

type AlbumPurchaseProps = CheckoutControls & {
  album: AlbumProps;
  currency: string;
  payments: PaymentsStatus;
  // Switches the sheet to the artist's subscriptions
  onSupport: () => void;
  // Opens an external store page inside the in-app viewer
  onBrowseExternal?: (url: string) => void;
};

// Buying one release: Mirlo releases check out on Mirlo, other sources link to their stores
export function AlbumPurchase({
  album,
  currency,
  payments,
  onSupport,
  onBrowseExternal,
  ...checkout
}: AlbumPurchaseProps) {
  if (!sellsOnMirlo(album)) {
    return <ExternalStores album={album} onBrowseExternal={onBrowseExternal} />;
  }
  if (album.isGettable === false) {
    return (
      <>
        <AlbumHeader album={album} />
        <Notice
          icon="star-outline"
          title="Comes with a subscription"
          body={`${album.artist?.name || "The artist"} shares this release with their subscribers.`}
        />
        <PrimaryButton label="See subscriptions" onPress={onSupport} />
      </>
    );
  }
  if (isFreeAlbum(album)) return <FreeAlbum album={album} {...checkout} />;
  return (
    <PaymentsGate status={payments} artistName={album.artist?.name}>
      <AlbumHeader album={album} />
      <PriceForm
        label="Price"
        currency={currency}
        minimum={album.minPrice ?? 0}
        initial={defaultAlbumPrice(album)}
        chips={priceChips(album.minPrice ?? 0, album.suggestedPrice)}
        noteTo={album.artist?.name || "the artist"}
        action={(price) => (price ? `Buy for ${price}` : "Buy")}
        busy={checkout.busy}
        error={checkout.error}
        onSubmit={(cents, { message, guestEmail }) =>
          checkout.onPay({
            artistId: album.artistId,
            artistSlug: albumArtistSlug(album),
            items: [{ type: "trackGroup", id: album.id, price: String(cents), message }],
            guestEmail,
          })
        }
      />
    </PaymentsGate>
  );
}

// Mirlo serves the artist page at either the artist's slug or id
function albumArtistSlug(album: AlbumProps): string {
  return album.artist?.urlSlug || String(album.artistId);
}

// Mirlo gives free albums to signed-in listeners only
function FreeAlbum({ album, onPay, busy, error }: CheckoutControls & { album: AlbumProps }) {
  const { user } = useAuthContext();
  const router = useRouter();
  return (
    <>
      <AlbumHeader album={album} />
      {user ? (
        <>
          <Text style={styles.body}>
            This release is free. Adding it unlocks full playback and saves it to your Library.
          </Text>
          <ErrorText message={error} />
          <PrimaryButton
            label="Add to collection"
            busy={busy}
            onPress={() =>
              onPay({
                artistId: album.artistId,
                artistSlug: albumArtistSlug(album),
                items: [{ type: "trackGroup", id: album.id, price: "0" }],
              })
            }
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>
            This release is free for Mirlo listeners. Sign in to add it to your collection.
          </Text>
          <PrimaryButton label="Sign in" icon="log-in-outline" onPress={() => router.push("/login")} />
        </>
      )}
    </>
  );
}

// Releases sold elsewhere. Faircamp releases get the sheet's own Faircamp checkout; other
// sources list their stores, which open in the viewer
function ExternalStores({
  album,
  onBrowseExternal,
}: {
  album: AlbumProps;
  onBrowseExternal?: (url: string) => void;
}) {
  const links = externalPurchaseLinks(album);
  const artistName = album.artist?.name || "the artist";
  const open = (url: string) => (onBrowseExternal ? onBrowseExternal(url) : openInBrowser(url));

  if (album.source === "Faircamp") {
    return (
      <>
        <AlbumHeader album={album} />
        <FaircampShop album={album} onOpen={open} />
      </>
    );
  }

  return (
    <>
      <AlbumHeader album={album} />
      {links.length > 0 ? (
        <>
          <Text style={styles.body}>
            Buying directly supports {artistName} and unlocks downloads on their store.
          </Text>
          {links.map((link, index) =>
            index === 0 ? (
              <PrimaryButton key={link.url} label={link.label} icon="storefront-outline" onPress={() => open(link.url)} />
            ) : (
              <SecondaryButton key={link.url} label={link.label} icon="storefront-outline" onPress={() => open(link.url)} />
            ),
          )}
        </>
      ) : (
        <Notice icon="storefront-outline" title="No store listed" body="This release doesn't list a place to buy it." />
      )}
    </>
  );
}
