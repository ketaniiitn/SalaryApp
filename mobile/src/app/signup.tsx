import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorLine, Field, ShowToggle } from "@/components/field";
import { Cover, Page, Wordmark } from "@/components/page";
import { ServerProblem } from "@/components/server-problem";
import { ApiError, isOffline } from "@/lib/api";
import { useSession } from "@/lib/session";

type Problems = { name?: string; email?: string; password?: string; taken?: boolean; offline?: boolean; other?: string };

export default function SignupScreen() {
  const { signup } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [saving, setSaving] = useState(false);

  function check(): Problems {
    const next: Problems = {};
    if (!name.trim()) next.name = "Write your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "That doesn't look like an email. Check it.";
    if (password.length < 8) next.password = "Use at least 8 letters or numbers.";
    return next;
  }

  async function submit() {
    const found = check();
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
    } catch (caught) {
      if (isOffline(caught)) setProblems({ offline: true });
      else if (caught instanceof ApiError && caught.status === 409) setProblems({ taken: true });
      else setProblems({ other: caught instanceof Error ? caught.message : "The account was not made. Try again." });
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
            Attendance and pay for your shop, in one book.
          </AppText>
        </Cover>
      }
      dock={
        <>
          <Button label={saving ? "Making your account…" : "Create account"} loading={saving} onPress={submit} />
          <View className="flex-row flex-wrap items-center justify-center py-2.5">
            <AppText tone="ink2">Already have an account? </AppText>
            <Link href="/login" replace asChild>
              <Pressable accessibilityRole="link" hitSlop={10}>
                <AppText variant="bold" style={{ textDecorationLine: "underline" }}>
                  Sign in
                </AppText>
              </Pressable>
            </Link>
          </View>
        </>
      }>
      <View className="pt-5" style={{ opacity: saving ? 0.55 : 1 }} pointerEvents={saving ? "none" : "auto"}>
        <AppText variant="display" size="title" accessibilityRole="header" className="mb-5">
          Create your account
        </AppText>
        {problems.offline ? (
          <View className="mb-5">
            <ServerProblem onRetry={submit} />
          </View>
        ) : null}
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={problems.name}
          onBlur={() => name && setProblems((p) => ({ ...p, name: check().name }))}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={problems.email}
          onBlur={() => email && setProblems((p) => ({ ...p, email: check().email }))}
        />
        {problems.taken ? (
          <View className="-mt-3 mb-5 flex-row flex-wrap items-center">
            <ErrorLine message="This email already has an account." />
            <Link href="/login" replace asChild>
              <Pressable accessibilityRole="link" hitSlop={10} className="ml-7">
                <AppText variant="bold" tone="cloth" style={{ textDecorationLine: "underline" }}>
                  Sign in instead
                </AppText>
              </Pressable>
            </Link>
          </View>
        ) : null}
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          hint="At least 8 letters or numbers."
          error={problems.password}
          onSubmitEditing={submit}
          suffix={<ShowToggle shown={show} onPress={() => setShow((s) => !s)} />}
        />
        {problems.other ? <ErrorLine message={problems.other} /> : null}
      </View>
    </Page>
  );
}
