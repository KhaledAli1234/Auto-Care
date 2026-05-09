import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { UserProfileProvider } from "@/context/user-profile-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <UserProfileProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="create-account" />
          <Stack.Screen name="verify-otp" />
          <Stack.Screen name="vehicle-setup" />
          <Stack.Screen name="maintenance-baseline" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="trips" />
          <Stack.Screen name="record-trip" />
          <Stack.Screen name="track" />
          <Stack.Screen name="track-live" />
          <Stack.Screen name="community" />
          <Stack.Screen name="ai-assistant" />
          <Stack.Screen name="trip-details/[id]" />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </UserProfileProvider>
  );
}
