import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useNowPlayingSheet } from "@/state/NowPlayingSheet";
import { theme } from "@/constants/theme";
import NowPlaying from "@/components/NowPlaying";

// Now Playing as a sheet over the whole app, following `progress` from the sheet state.
// Its contents load the first time it opens and stay ready after that
export default function NowPlayingSheet() {
  const { progress, height, hasOpened } = useNowPlayingSheet();

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height.value }],
  }));

  return (
    <Animated.View style={[styles.sheet, sheetStyle]}>{hasOpened && <NowPlaying />}</Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
});
