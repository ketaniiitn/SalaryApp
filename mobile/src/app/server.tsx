import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Mark, Stamp } from "@/components/book";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Page } from "@/components/page";
import { getHealth } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { useSession } from "@/lib/session";

type Status = "editing" | "checking" | "connected" | "failed";

/** Add a scheme when the owner leaves it out: http for local addresses, https for everything else. */
function normalise(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(trimmed);
  return `${local ? "http" : "https"}://${trimmed}`;
}

async function answers(address: string, signal: AbortSignal): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 8000));
  const check = getHealth(address)
    .then((health) => !signal.aborted && health.ok)
    .catch(() => false);
  return Promise.race([check, timeout]);
}

export default function ServerScreen() {
  const { url, defaultUrl, setUrl } = useServerUrl();
  const { session } = useSession();
  const [draft, setDraft] = useState(url);
  const [status, setStatus] = useState<Status>("editing");
  const [current, setCurrent] = useState<"checking" | "ok" | "down">("checking");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    answers(url, controller.signal).then((ok) => {
      if (!controller.signal.aborted) setCurrent(ok ? "ok" : "down");
    });
    return () => controller.abort();
  }, [url]);

  async function checkAndSave() {
    const next = normalise(draft);
    setDraft(next);
    if (!next) {
      setStatus("failed");
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStatus("checking");
    const ok = await answers(next, controller.signal);
    if (controller.signal.aborted) return;
    if (!ok) {
      setStatus("failed");
      return;
    }
    await setUrl(next);
    setStatus("connected");
  }

  function stop() {
    abort.current?.abort();
    setStatus("editing");
  }

  const backLabel = session ? "Home" : "Sign in";
  const checking = status === "checking";

  return (
    <Page
      keyboard
      back={{ label: backLabel, fallback: session ? "/" : "/login", disabled: checking }}
      dock={
        status === "connected" ? (
          <Button label={session ? "Back to Home" : "Back to sign in"} onPress={() => (router.canGoBack() ? router.back() : router.replace(session ? "/" : "/login"))} />
        ) : (
          <>
            <Button label={checking ? "Checking the address…" : "Check and save"} loading={checking} onPress={checkAndSave} />
            {checking ? (
              <Button label="Stop" variant="text" onPress={stop} />
            ) : status === "failed" ? (
              <Button
                label="Keep the old address"
                variant="text"
                onPress={() => {
                  setDraft(url);
                  setStatus("editing");
                }}
              />
            ) : draft !== defaultUrl ? (
              <Button label="Use the original address" variant="text" onPress={() => setDraft(defaultUrl)} />
            ) : null}
          </>
        )
      }>
      <View>
        <AppText variant="display" size="title" accessibilityRole="header">
          Server address
        </AppText>
        <AppText tone="ink2" className="mt-2">
          Salary keeps your book on a server. Only change this if the person who set up the app gave you a new address.
        </AppText>
      </View>
      <View style={{ opacity: checking ? 0.55 : 1 }} pointerEvents={checking ? "none" : "auto"}>
        <Field
          label="Server address"
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (status !== "checking") setStatus("editing");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://salary.yourshop.in"
          hint="Starts with http:// or https://"
          error={
            status === "failed"
              ? draft
                ? "Nothing answered at this address. Check the spelling, or ask the person who set up Salary."
                : "Write the server address."
              : null
          }
          onSubmitEditing={checkAndSave}
        />
        {status === "connected" ? (
          <View className="gap-3">
            <Stamp label="Connected · saved" tick big />
            <AppText tone="ink2">Salary will use this address from now on.</AppText>
          </View>
        ) : status === "failed" ? (
          <AppText tone="ink2">The old address is still in use. Nothing was changed.</AppText>
        ) : (
          <View className="flex-row items-center">
            {current === "checking" ? null : <Mark kind={current === "ok" ? "present" : "away"} size={26} />}
            <AppText tone="ink2" className="ml-2.5 flex-1">
              {current === "checking"
                ? "Checking the address in use now…"
                : current === "ok"
                  ? "The address in use now works."
                  : "The address in use now isn't answering."}
            </AppText>
          </View>
        )}
      </View>
    </Page>
  );
}
