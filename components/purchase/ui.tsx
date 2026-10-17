import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { formatMoney } from "@/queries/listener";
import { toAmountText, type PriceChip } from "./helpers";

// Building blocks shared by every view of the purchase sheet

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Notice({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={styles.notice}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.notice}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {label ? <Text style={[styles.body, styles.loadingLabel]}>{label}</Text> : null}
    </View>
  );
}

export function LoadError() {
  return (
    <Notice
      icon="cloud-offline-outline"
      title="Couldn't reach Mirlo"
      body="Check your connection and open this again."
    />
  );
}

// Cover, title and artist at the top of an album purchase
export function AlbumHeader({ album }: { album: AlbumProps }) {
  const cover = album.cover?.sizes?.[300] || album.cover?.sizes?.[600];
  return (
    <View style={styles.albumHeader}>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
      <View style={styles.albumHeaderText}>
        <Text style={styles.albumTitle} numberOfLines={2}>
          {album.title}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {album.artist?.name}
        </Text>
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.button, styles.primaryButton, (busy || disabled) && styles.buttonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.playButtonIcon} />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{label}</Text>
          {icon ? <Ionicons name={icon} size={16} color={theme.colors.playButtonIcon} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, styles.secondaryButton, disabled && styles.buttonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
      {icon ? <Ionicons name={icon} size={16} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, input.multiline && styles.inputMultiline]}
        {...input}
      />
    </View>
  );
}

// A price in major units with quick-pick chips and the minimum underneath
export function AmountField({
  label,
  value,
  onChangeText,
  currency,
  minimum,
  chips = [],
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  currency: string;
  minimum?: number;
  chips?: PriceChip[];
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label} ({currency.toUpperCase()})
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, styles.amountInput]}
        accessibilityLabel={label}
      />
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => {
            const text = toAmountText(chip.cents);
            const selected = value === text;
            return (
              <Pressable
                key={chip.label}
                onPress={() => onChangeText(text)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`${chip.label} ${formatMoney(chip.cents, currency)}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {chip.label} · {formatMoney(chip.cents, currency)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {minimum ? (
        <Text style={styles.hint}>Minimum {formatMoney(minimum, currency)}. Pay more if you like.</Text>
      ) : null}
    </View>
  );
}

export function GuestEmailField({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <Field
      label="Your email (for the receipt and download link)"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoComplete="email"
      inputMode="email"
      keyboardType="email-address"
    />
  );
}

export function ErrorText({ message }: { message?: string }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export type PaymentsStatus = "loading" | "error" | "enabled" | "disabled";

// Shows a paid form once Mirlo confirms the artist can take card payments
export function PaymentsGate({
  status,
  artistName,
  children,
}: {
  status: PaymentsStatus;
  artistName?: string;
  children: ReactNode;
}) {
  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError />;
  if (status === "disabled") {
    return (
      <Notice
        icon="card-outline"
        title="Payments aren't set up yet"
        body={`${artistName || "This artist"} isn't taking payments on Mirlo yet.`}
      />
    );
  }
  return <>{children}</>;
}

export const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    padding: 24,
    gap: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  notice: {
    alignItems: "center",
    paddingVertical: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 210, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingLabel: {
    marginTop: 16,
  },
  albumHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  albumHeaderText: {
    flex: 1,
    alignItems: "flex-start",
  },
  albumTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  button: {
    width: "100%",
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.playButtonIcon,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  amountInput: {
    fontSize: 22,
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: {
    backgroundColor: "rgba(0, 210, 255, 0.2)",
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: "center",
  },
});
