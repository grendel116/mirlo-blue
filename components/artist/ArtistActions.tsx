import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import FollowArtistButton from "@/components/FollowArtistButton";
import PillButton from "@/components/artist/PillButton";
import { openPurchase } from "@/scripts/openPurchase";
import { openInBrowser } from "@/scripts/openInBrowser";
import { artistShareUrl, shareMessage } from "@/scripts/share";
import { MIRLO_WEB } from "@/queries/listener";

// Follow, Support, Share and Contact for an artist. `routeId` is the id in the
// artist page's route, the same id the purchase sheet takes
export default function ArtistActions({ artist, routeId }: { artist: Artist; routeId: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const slug = artist.urlSlug || String(artist.id);
  const isMirlo = Boolean(artist.onMirlo);

  const share = async () => {
    const wasCopied = await shareMessage(artistShareUrl(slug), artist.name);
    if (wasCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.row}>
      <FollowArtistButton artist={artist} />
      {isMirlo ? (
        <PillButton
          icon="cash-outline"
          label="Support"
          onPress={() => openPurchase(router, { kind: "support", artist: routeId })}
          accessibilityLabel={`Support ${artist.name}`}
        />
      ) : null}
      <PillButton
        icon={copied ? "checkmark" : "share-social-outline"}
        label={copied ? "Link copied" : "Share"}
        onPress={share}
        accessibilityLabel={`Share ${artist.name}`}
      />
      {isMirlo && artist.allowDirectMessages !== false ? (
        // Mirlo's contact form asks for a Cloudflare Turnstile check, so messages are
        // written on the artist's Mirlo page
        <PillButton
          icon="mail-outline"
          label="Contact"
          onPress={() => openInBrowser(`${MIRLO_WEB}/${slug}`)}
          accessibilityLabel={`Contact ${artist.name} on Mirlo`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
