import "../global.css";

import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";

import { useSession, SessionProvider } from "@/lib/session";
import { ServerUrlProvider } from "@/lib/server-url";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ServerUrlProvider>
      <SessionProvider>
        <RootNavigation />
      </SessionProvider>
    </ServerUrlProvider>
  );
}

function RootNavigation() {
  const { session, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const top = segments[0];

  useEffect(() => {
    if (!ready) return;
    const open = top === "login" || top === "signup" || top === "server";
    if (!session && !open) router.replace("/login");
    if (session && (top === "login" || top === "signup")) router.replace("/");
  }, [ready, router, top, session]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </>
  );
}
