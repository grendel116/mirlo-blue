import { View, Pressable, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useAuthContext } from "@/state/AuthContext";
import { useLogoutMutation } from "@/queries/authQueries";
import { useTranslation } from "react-i18next";
import { theme } from "@/constants/theme";

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

      <View style={styles.content}>
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
          <Pressable
            onPress={() => {
              router.back();
              router.navigate("/");
            }}
            style={styles.menuItem}
          >
            <Ionicons name="home-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.menuText}>Home / Releases</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.back();
              router.navigate("/library");
            }}
            style={styles.menuItem}
          >
            <Ionicons name="layers-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.menuText}>Library (Collection & Wishlist)</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.back();
              router.navigate("/search");
            }}
            style={styles.menuItem}
          >
            <Ionicons name="search-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.menuText}>Search & Discover</Text>
          </Pressable>

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
    flex: 1,
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
