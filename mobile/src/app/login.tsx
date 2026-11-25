import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner } from "@/components/book";
import { Button } from "@/components/button";
import { ErrorLine, Field, ShowToggle } from "@/components/field";
import { GearIcon } from "@/components/icons";
import { Cover, Page, Wordmark } from "@/components/page";
import { ServerProblem } from "@/components/server-problem";
import { ApiError, isOffline } from "@/lib/api";
import { useSession } from "@/lib/session";

/** The last email used to sign in, so returning owners only type the password. */
const LAST_EMAIL_KEY = "salaryapp.lastEmail";

type Problem = "wrong" | "offline" | "missing" | { other: string } | null;

export default function LoginScreen() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY)
      .then((saved) => {
        if (saved) setEmail((current) => current || saved);
      })
      .catch(() => undefined);
  }, []);

  async function submit() {
    if (!email.trim() || !password) {
      setProblem("missing");
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim()).catch(() => undefined);
      await login({ email: email.trim(), password });
    } catch (caught) {
      if (isOffline(caught)) setProblem("offline");
      else if (caught instanceof ApiError && (caught.status === 401 || caught.status === 400)) {
        setProblem("wrong");
        setPassword("");
      } else setProblem({ other: caught instanceof Error ? caught.message : "That didn't work. Try again." });
      setSaving(false);
    }
  }

  return (
    <Page
      keyboard
      header={
        <Cover>
          <Wordmark />
          <AppText size="base" tone="ink3" className="mt-2">
            Welcome back.
          </AppText>
        </Cover>
      }
      dock={
        <>
          <Button label={saving ? "Signing in…" : "Sign in"} loading={saving} onPress={submit} />
          <View className="flex-row flex-wrap items-center justify-center pt-2.5">
            <AppText tone="ink2">New here? </AppText>
            <Link href="/signup" replace asChild>
              <Pressable accessibilityRole="link" hitSlop={10}>
                <AppText variant="bold" style={{ textDecorationLine: "underline" }}>
                  Create an account
                </AppText>
              </Pressable>
            </Link>
          </View>
          <Link href="/server" asChild>
            <Pressable accessibilityRole="link" className="min-h-12 flex-row items-center justify-center active:opacity-60">
              <GearIcon />
              <AppText variant="medium" size="sm" tone="ink3" className="ml-1.5">
                Server settings
              </AppText>
            </Pressable>
          </Link>
        </>
      }>
      <View className="pt-5" style={{ opacity: saving ? 0.55 : 1 }} pointerEvents={saving ? "none" : "auto"}>
        <AppText variant="display" size="title" accessibilityRole="header" className="mb-5">
          Sign in
        </AppText>
        {problem === "wrong" ? (
          <View className="mb-5">
            <Banner>That email and password don't match. Check them and try again.</Banner>
          </View>
        ) : null}
        {problem === "offline" ? (
          <View className="mb-5">
            <ServerProblem onRetry={submit} />
          </View>
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={problem === "missing" && !email.trim() ? "Write your email." : null}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          placeholder={problem === "wrong" ? "Type your password again" : undefined}
          error={problem === "missing" && !password ? "Write your password." : null}
          onSubmitEditing={submit}
          suffix={<ShowToggle shown={show} onPress={() => setShow((s) => !s)} />}
        />
        {problem && typeof problem === "object" ? <ErrorLine message={problem.other} /> : null}
      </View>
    </Page>
  );
}
