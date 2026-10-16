import { Tabs } from "expo-router";

// Home, Queue, and Library stay loaded side by side, so switching between them is instant.
// The app-wide Footer draws the tab bar; inactive tabs freeze until they come back into view
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: "#070b14" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="library" />
    </Tabs>
  );
}
