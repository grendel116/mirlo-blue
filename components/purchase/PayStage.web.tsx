import { StyleSheet, View } from "react-native";
import type { PayStageProps } from "./useCheckout";
import { Card, Notice, PrimaryButton, SecondaryButton } from "./ui";

// On the web Mirlo's checkout runs in its own tab; the sheet waits here meanwhile
// and checks again whenever the listener comes back to this tab
export function PayStage({ checkoutUrl, onPaid, onCancel }: PayStageProps) {
  return (
    <View style={styles.container}>
      <Card>
        <Notice
          icon="open-outline"
          title="Finish paying on Mirlo"
          body="Mirlo's checkout is open in a new tab. Come back here once you've paid."
        />
        <PrimaryButton label="I've finished paying" onPress={onPaid} />
        <SecondaryButton
          label="Open the checkout again"
          icon="open-outline"
          onPress={() => window.open(checkoutUrl, "_blank")}
        />
        <SecondaryButton label="Cancel" onPress={onCancel} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
});
