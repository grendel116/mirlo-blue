import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View, ViewProps } from "react-native";
import SearchBar from "./searchBar";
import { useRouter } from "expo-router";
import { useSearch } from "@/state/SearchContext";
import { theme } from "@/constants/theme";

export default function SearchHeader({ style }: ViewProps) {
  const router = useRouter();
  const { setSearchValue, setSearchResults } = useSearch();
  return (
    <View style={[styles.headerContainer, style]}>
      <Ionicons
        name="search-outline"
        size={24}
        color={theme.colors.primary}
        style={styles.searchIcon}
      />
      <SearchBar />
      <Pressable
        onPress={() => {
          setSearchValue("");
          setSearchResults([]);
          router.dismiss(1);
        }}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Close search"
      >
        <Ionicons
          name="close"
          size={24}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    width: "100%",
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
    backgroundColor: theme.colors.surface,
  },
  searchIcon: {
    marginRight: 8,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
});
