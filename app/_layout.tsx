import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";

import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack, usePathname } from "expo-router";

import { UserProfileProvider } from "@/context/user-profile-context";
import {
  AppThemeProvider,
  useAppTheme,
} from "@/context/theme-context";
import SplashScreen from "./splash";

function RootNavigator() {
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(true);
  const { isDark } = useAppTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const publicRoutes = new Set([
      "/",
      "/welcome",
      "/sign-in",
      "/create-account",
      "/forgot-password",
      "/verify-otp",
      "/reset-password",
    ]);

    const redirectIfLoggedOut = async () => {
      if (showSplash || publicRoutes.has(pathname)) return;

      const token = await AsyncStorage.getItem("access_token");

      if (!token) {
        if (router.canDismiss()) {
          router.dismissAll();
        }

        router.replace("/welcome");
      }
    };

    redirectIfLoggedOut();
  }, [pathname, showSplash]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <UserProfileProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            animationDuration: 150,
          }}
        >
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
              animation: "fade_from_bottom",
              animationDuration: 200,
            }}
          />

          <Stack.Screen
            name="modal"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
        </Stack>

        <StatusBar style={isDark ? "light" : "dark"} />
      </ThemeProvider>
    </UserProfileProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}