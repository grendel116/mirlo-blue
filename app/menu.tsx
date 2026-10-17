import { View, Pressable, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useAuthContext } from "@/state/AuthContext";
import { useLogoutMutation } from "@/queries/authQueries";
import { MIRLO_WEB } from "@/queries/listener";
import { useTranslation } from "react-i18next";
import { theme } from "@/constants/theme";
import { openLibraryTab, openMainTab } from "@/components/Footer";
import { openInBrowser } from "@/scripts/openInBrowser";

const SOURCE_CODE_URL = "https://github.com/grendel116/mirlo-blue";

type MenuEntry = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
};

export default function Menu() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { t } = useTranslation("translation");

  const { mutate: logout } = useLogoutMutation();
  const onLogOut = () => {
    logout(undefined, {
      onSuccess() {
        router.dismissTo("/");
      },
    });
  };

  // Screens on top of Home open after the menu closes
  const openScreen = (path: "/activity" | "/search") => {
    router.back();
    router.navigate(path);
  };

  const entries: MenuEntry[] = [
    { icon: "home-outline", label: "Home / Releases", onPress: () => openMainTab("home") },
    { icon: "layers-outline", label: "Library", onPress: () => openMainTab("library") },
    { icon: "albums-outline", label: "Collection", onPress: () => openLibraryTab("collection") },
    {
      icon: "people-outline",
      label: "Followed Artists",
      onPress: () => openLibraryTab("artists"),
    },
    {
      icon: "notifications-outline",
      label: "Your Activity",
      onPress: () => openScreen("/activity"),
    },
    { icon: "search-outline", label: "Search & Discover", onPress: () => openScreen("/search") },
  ];
  if (user) {
    // Account, profile and artist settings live on Mirlo
    entries.push({
      icon: "open-outline",
      label: "Manage on Mirlo",
      onPress: () => openInBrowser(`${MIRLO_WEB}/profile`),
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.dismiss()}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <Ionicons
            name="chevron-down"
            size={28}
            color={theme.colors.textSecondary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>MENU</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          {user && user.name ? (
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Ionicons name="person" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userSub}>Mirlo Cooperative Member</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.menuList}>
            {entries.map((entry) => (
              <Pressable key={entry.label} onPress={entry.onPress} style={styles.menuItem}>
                <Ionicons name={entry.icon} size={22} color={theme.colors.primary} />
                <Text style={styles.menuText}>{entry.label}</Text>
              </Pressable>
            ))}

            <Pressable
              style={[styles.menuItem, styles.authMenuItem]}
              onPress={() => {
                if (user) {
                  onLogOut();
                } else {
                  router.dismissTo("/login");
                }
              }}
            >
              <Ionicons
                name={user ? "log-out-outline" : "log-in-outline"}
                size={22}
                color={user ? theme.colors.textSecondary : theme.colors.primary}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: user ? theme.colors.textSecondary : theme.colors.primary },
                ]}
              >
                {user ? t("headerMenu.logOut") : t("headerMenu.logIn")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View>
          <Pressable
            style={styles.sourceLink}
            onPress={() => openInBrowser(SOURCE_CODE_URL)}
            accessibilityRole="link"
          >
            <Ionicons name="code-slash-outline" size={16} color={theme.colors.textSecondary} />
            <View>
              <Text style={styles.sourceText}>Source code</Text>
              <Text style={styles.sourceCaption}>AGPL-3.0 · based on the Mirlo mobile app</Text>
            </View>
          </Pressable>

          {user ? (
            <Pressable
              style={styles.deleteBtn}
              onPress={() => router.push("/deleteAccount")}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteText}>{t("profile.deleteAccount")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
    backgroundColor: theme.colors.surface,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    ...theme.typography.sectionHeader,
    fontSize: 14,
    color: theme.colors.primary,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    marginBottom: 20,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  userSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  menuList: {
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    gap: 14,
  },
  authMenuItem: {
    marginTop: 12,
  },
  menuText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    marginTop: 20,
  },
  sourceText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  sourceCaption: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 20,
  },
  deleteText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
});
