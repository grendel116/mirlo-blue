import { useSearch } from "@/state/SearchContext";
import { Controller, useForm } from "react-hook-form";
import { useCallback } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

export default function SearchInput() {
  const { searchValue, setSearchValue } = useSearch();
  const { control } = useForm();

  const onChangeValue = useCallback((text: string) => {
    setSearchValue(text);
  }, []);

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="search"
        render={() => (
          <TextInput
            style={styles.input}
            placeholder="Search artists, tracks, tags..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchValue}
            onChangeText={onChangeValue}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    color: theme.colors.textPrimary,
    height: 42,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
