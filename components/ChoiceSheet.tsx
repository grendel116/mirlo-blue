import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";
import { showChoice, useChoice } from "@/state/choice";

// The app's own pick-one dialog, matching the web build's: a card with the title, a hint, and
// one full-width button per action. Tapping outside, or Cancel, closes it
export default function ChoiceSheet() {
  const choice = useChoice();
  if (!choice) return null;

  const close = () => showChoice(null);
  const buttons = choice.buttons.some((b) => b.style === "cancel")
    ? choice.buttons
    : [...choice.buttons, { text: "Cancel", style: "cancel" as const }];

  return (
    <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{choice.title}</Text>
          {choice.message ? <Text style={styles.message}>{choice.message}</Text> : null}
          <View style={styles.buttons}>
            {buttons.map((b, i) => {
              const primary = b.style !== "cancel" && b.style !== "destructive";
              const destructive = b.style === "destructive";
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  android_ripple={{ color: theme.colors.ripple }}
                  onPress={() => {
                    close();
                    b.onPress?.();
                  }}
                  style={[
                    styles.button,
                    primary && styles.primary,
                    destructive && styles.destructive,
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      primary && { color: theme.colors.playButtonIcon },
                      destructive && { color: "#ff6b6b" },
                    ]}
                  >
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    padding: 20,
  },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  message: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  buttons: { gap: 8, marginTop: 16 },
  button: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  primary: { backgroundColor: theme.colors.primary },
  destructive: { borderColor: "#ff6b6b" },
  buttonText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "700" },
});
