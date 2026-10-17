import { StyleSheet, Text, View } from "react-native";
import { useAuthContext } from "@/state/AuthContext";
import DownloadAlbumButton from "@/components/DownloadAlbumButton";
import { ownsAlbum } from "@/scripts/utils";
import type { PurchaseItem } from "@/queries/listener";
import type { CheckoutOutcome } from "./useCheckout";
import { Loading, Notice, PrimaryButton, styles as ui } from "./ui";

export function Confirming() {
  return <Loading label="Confirming your payment with Mirlo…" />;
}

const RECORDED: Record<PurchaseItem["type"], string> = {
  trackGroup: "The album is in your Library now.",
  catalogue: "Every release is in your Library now.",
  subscription: "You're subscribed.",
  tip: "Your tip is on its way.",
};

// The thank-you at the end of a checkout. A freshly bought album can be downloaded straight away
export function Done({
  outcome,
  purchaseType,
  artistName,
  album,
  email,
  onDone,
}: {
  outcome: CheckoutOutcome;
  purchaseType: PurchaseItem["type"];
  artistName: string;
  album?: AlbumProps;
  email?: string;
  onDone: () => void;
}) {
  const { user } = useAuthContext();
  const sendsDownloads = purchaseType === "trackGroup" || purchaseType === "catalogue";
  const detail = {
    recorded: RECORDED[purchaseType],
    emailed: `Mirlo will email your receipt${sendsDownloads ? " and download link" : ""} to ${email}.`,
    processing: "Mirlo is still processing your payment. It will appear in your Library shortly.",
  }[outcome];
  const canDownload = outcome === "recorded" && album && ownsAlbum(user, album);

  return (
    <>
      <Notice icon="checkmark-circle" title={`Thank you for supporting ${artistName}!`} body={detail} />
      {canDownload ? (
        <View style={styles.download}>
          <DownloadAlbumButton album={album} size={40} />
          <Text style={ui.body}>Download it now</Text>
        </View>
      ) : null}
      <PrimaryButton label="Done" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  download: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
