import { Stack } from "expo-router";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SearchContextProvider } from "@/state/SearchContext";
import { PlayerContextProvider } from "@/state/PlayerContext";
import { AuthContextProvider } from "@/state/AuthContext";
import { QueryClientWrapper } from "@/queries/QueryClientWrapper";
import { DevToolsBubble } from "react-native-react-query-devtools";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import TrackPlayer from "react-native-track-player";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { AppReadyContextProvider } from "@/state/AppReadyContext";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";
import NowPlaying from "@/components/NowPlaying";
import ChoiceSheet from "@/components/ChoiceSheet";
import "../i18n";
import { checkForUpdates } from "../scripts/appVersionCheck";
import { openMusicFolder } from "@/scripts/musicFolder";

SplashScreen.preventAutoHideAsync();

// Keep the home screen under deep-linked routes: it is what hides the splash
// once data loads, and Back then returns home instead of leaving the app
export const unstable_settings = { anchor: "index" };

SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

TrackPlayer.registerPlaybackService(() => require("../scripts/service"));

export default function RootLayout() {
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [fontsLoaded, fontError] = useFonts({
    Cubano: require("../assets/fonts/Cubano.otf"),
    OpenSans: require("../assets/fonts/OpenSans-VariableFont_wdth,wght.ttf"),
  });
  // Needed for TanStack Query Devtools
  const onCopy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    checkForUpdates();
    openMusicFolder().catch((err) => console.warn("Couldn't reopen the music folder:", err));
  }, []);

  useEffect(() => {
    // Hide the splash screen only when fonts are ready and Home has loaded its first content.
    // A 4-second safety timer guarantees the splash screen will never get stuck offline.
    const fallbackTimer = setTimeout(() => {
      if (fontsLoaded || fontError) {
        SplashScreen.hide();
      }
    }, 4000);

    if ((fontsLoaded || fontError) && isDataLoaded) {
      clearTimeout(fallbackTimer);
      SplashScreen.hide();
    }

    return () => clearTimeout(fallbackTimer);
  }, [fontsLoaded, fontError, isDataLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#070b14" }}>
    <AppReadyContextProvider
      value={{ isDataLoaded: isDataLoaded, setIsDataLoaded: setIsDataLoaded }}
    >
      <QueryClientWrapper>
        <AuthContextProvider>
          <PlayerContextProvider>
            <SearchContextProvider>
              <View style={{ flex: 1, overflow: "hidden" }}>
                <Stack
                  screenOptions={{
                    animation: "none",
                    contentStyle: { backgroundColor: "#070b14" },
                  }}
                >
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="index"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="feed"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="library"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="activity"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="artist/[id]"
                    options={{
                      headerShown: false,
                      animation: "none",
                    }}
                  />
                  <Stack.Screen
                    name="now-playing"
                    options={{
                      headerShown: false,
                      presentation: "transparentModal",
                    }}
                  />
                  <Stack.Screen
                    name="search"
                    options={{
                      headerShown: false,
                      animation: "fade",
                      animationDuration: 300,
                      presentation: "transparentModal",
                    }}
                  />
                  <Stack.Screen
                    name="deleteAccount"
                    options={{
                      headerShown: false,
                      presentation: "modal",
                      animation: "slide_from_bottom",
                      animationDuration: 200,
                    }}
                  />
                  <Stack.Screen
                    name="tags/[tag]"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="station/[id]"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="podcast/[id]"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="mostPlayed"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="topSold"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="maxPlaysReached"
                    options={{
                      headerShown: false,
                      presentation: "modal",
                      animation: "slide_from_bottom",
                      animationDuration: 200,
                    }}
                  />

                  <Stack.Screen
                    name="purchaseModal"
                    options={{
                      headerShown: false,
                      presentation: "transparentModal",
                      animation: "slide_from_bottom",
                      animationDuration: 200,
                      contentStyle: { backgroundColor: "transparent" },
                    }}
                  />
                  <Stack.Screen
                    name="emailVerificationModal"
                    options={{
                      headerShown: false,
                      presentation: "modal",
                      animation: "slide_from_bottom",
                      animationDuration: 200,
                    }}
                  />
                </Stack>
                <NowPlaying />
              </View>
              <Footer />
              <ChoiceSheet />
              <StatusBar style="light" backgroundColor="#070b14" />
            </SearchContextProvider>
          </PlayerContextProvider>
        </AuthContextProvider>
        {/* <DevToolsBubble onCopy={onCopy} /> */}
      </QueryClientWrapper>
    </AppReadyContextProvider>
    </GestureHandlerRootView>
  );
}
