import { Stack } from "expo-router";
import React from "react";
import { theme } from "@/constants/theme";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="album-tracks" />
      <Stack.Screen name="tracks/[trackId]" />
    </Stack>
  );
}
