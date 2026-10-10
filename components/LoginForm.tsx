import {
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Pressable,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useLoginMutation } from "@/queries/authQueries";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openInBrowser } from "@/scripts/openInBrowser";
import ErrorNotification from "./ErrorNotification";
import { theme } from "@/constants/theme";

type LoginInputs = {
  email: string;
  password: string;
};

export default function LoginForm() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputs>({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const router = useRouter();
  const [loginError, setLoginError] = useState<Error | null>(null);
  const { t } = useTranslation("translation", { keyPrefix: "logIn" });
  const [showError, setShowError] = useState<boolean>(true);

  const { mutate: login } = useLoginMutation();

  const handleBrowserOpen = async () => {
    await openInBrowser("https://mirlo.space/signup");
  };

  const onSubmit = async (data: LoginInputs) => {
    login(data, {
      onSuccess() {
        if (router.canDismiss()) {
          router.dismiss();
        } else {
          router.dismissTo("/");
        }
      },
      onError(e) {
        console.error("e", e.message);
        setLoginError(e);
        setShowError(true);
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>LOG IN TO MIRLO</Text>
      <Text style={styles.subheading}>Access your collection and supporting artist community.</Text>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>{t("email")}</Text>
        <Controller
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.inputStyle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@domain.com"
              placeholderTextColor={theme.colors.textMuted}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="email"
        />
        {errors.email && <Text style={styles.errorLabel}>Email is required</Text>}

        <Text style={styles.formLabel}>{t("password")}</Text>
        <Controller
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.inputStyle}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              secureTextEntry
            />
          )}
          name="password"
        />
        {errors.password && (
          <Text style={styles.errorLabel}>Password is required.</Text>
        )}
        {loginError && (
          <ErrorNotification
            visible={showError}
            onDismiss={() => setShowError(false)}
            error={loginError}
          />
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit(onSubmit)}
          accessibilityRole="button"
          accessibilityLabel="Log In"
        >
          <Text style={styles.buttonText}>{t("logIn")}</Text>
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Pressable onPress={handleBrowserOpen}>
            <Text style={styles.signupText}>
              Need an account? <Text style={styles.signupLink}>{t("signUp")}</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    alignItems: "stretch",
    width: "100%",
  },
  heading: {
    ...theme.typography.sectionHeader,
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 6,
  },
  subheading: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },
  formSection: {
    width: "100%",
  },
  formLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputStyle: {
    width: "100%",
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  errorLabel: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    height: 48,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    color: "#070b14",
    fontSize: 16,
    fontWeight: "700",
  },
  signupContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  signupText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  signupLink: {
    color: theme.colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
