import DismissModalBar from "@/components/DismissModalBar";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import * as api from "../queries/fetch/fetchWrapper";
import { useAuthContext } from "@/state/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { theme } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function AddFreeAlbumModal() {
  const { user, refreshLoggedInUser } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trackGroupTitle, trackGroupId } = useLocalSearchParams();
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [adding, setAdding] = useState(false);

  const getFreeAlbum = useCallback(async () => {
    try {
      if (!user) return;
      setAdding(true);
      await api.post(`/v1/trackGroups/${trackGroupId}/purchase`, {
        price: 0,
      });
      queryClient.invalidateQueries({
        queryKey: ["fetchUserPurchases", { userId: user.id }],
      });
      refreshLoggedInUser();
      setAdding(false);
      setIsAdded(true);
      setTimeout(() => {
        router.dismiss();
      }, 1200);
    } catch (err) {
      console.error("Issue purchasing free album", err);
      setAdding(false);
    }
  }, [trackGroupId, user, queryClient, refreshLoggedInUser, router]);

  return (
    <SafeAreaView style={styles.container}>
      <DismissModalBar />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={isAdded ? "checkmark-circle" : "bag-add-outline"}
              size={36}
              color={theme.colors.primary}
            />
          </View>

          <Text style={styles.title}>
            Add <Text style={styles.titleHighlight}>{trackGroupTitle}</Text> to your collection
          </Text>

          <Text style={styles.subtitle}>
            This release is free. Adding it unlocks full playback for all tracks and saves it to your permanent Library collection.
          </Text>

          <Pressable
            onPress={() => {
              if (!adding && !isAdded) {
                getFreeAlbum();
              }
            }}
            disabled={adding || isAdded}
            style={[
              styles.actionButton,
              isAdded && styles.actionButtonSuccess,
            ]}
          >
            {adding ? (
              <ActivityIndicator color={theme.colors.playButtonIcon} />
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  isAdded && styles.buttonTextSuccess,
                ]}
              >
                {isAdded ? "Added to Collection! ✓" : "Add to Collection"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    padding: 28,
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 210, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  titleHighlight: {
    color: theme.colors.textCyan,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  actionButton: {
    width: "100%",
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonSuccess: {
    backgroundColor: "rgba(0, 210, 255, 0.2)",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.playButtonIcon,
  },
  buttonTextSuccess: {
    color: theme.colors.primary,
  },
});
