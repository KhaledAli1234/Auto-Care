import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { UserProfileProvider } from "@/context/user-profile-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import SplashScreen from "./splash";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <UserProfileProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ 
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
        }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="create-account" />
          <Stack.Screen name="verify-otp" />
          <Stack.Screen name="vehicle-setup" />
          <Stack.Screen name="maintenance-baseline" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="admin-posts" />
          <Stack.Screen name="account" />
          <Stack.Screen name="trips" />
          <Stack.Screen name="record-trip" />
          <Stack.Screen name="track" />
          <Stack.Screen name="track-live" />
          <Stack.Screen name="community" />
          <Stack.Screen name="ai-assistant" />
          <Stack.Screen 
            name="trip-details/[id]"
            options={{ 
              animation: 'fade_from_bottom',
              animationDuration: 200,
            }} 
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", animation: 'slide_from_bottom' }}
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </UserProfileProvider>
  );
}