import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Empty, LoadError, Row, Skeleton } from "@/components/book";
import { Button } from "@/components/button";
import { BottomSheet } from "@/components/date-sheet";
import { BookArt, ChevronDown, ChevronRight, GearIcon } from "@/components/icons";
import { Cover, Page, Wordmark } from "@/components/page";
import { isOffline, listOrganisations } from "@/lib/api";
import { hasProgress, loadSetup, type SavedSetup } from "@/organisation/profile";
import { plural } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import type { OrganisationSummary } from "@/lib/types";

const RECENT_KEY = "salaryapp.recentWorkplaces";

export default function HomeScreen() {
  const { url, ready } = useServerUrl();
  const { session, logout } = useSession();
  const [workplaces, setWorkplaces] = useState<OrganisationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState<SavedSetup | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listOrganisations(url);
      const recent = await readRecent();
      rows.sort((a, b) => {
        const ra = recent.indexOf(a.id);
        const rb = recent.indexOf(b.id);
        if (ra !== rb) return (ra === -1 ? Infinity : ra) - (rb === -1 ? Infinity : rb);
        return a.createdAt < b.createdAt ? -1 : 1;
      });
      setWorkplaces(rows);
      setFailed(false);
      setProblem(null);
      if (session) {
        const saved = await loadSetup(session.admin.id);
        setPending(saved && hasProgress(saved.draft, session.admin) ? saved : null);
      }
    } catch (caught) {
      setWorkplaces(null);
      setFailed(true);
      setProblem(
        isOffline(caught)
          ? "The phone could not reach the server. Check the internet. If the server was asleep, it can take a minute to wake: pull down to try again."
          : caught instanceof Error
            ? caught.message
            : "Those workplaces could not be opened.",
      );
    }
  }, [session, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready || !session) return;
      load();
    }, [load, ready, session]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const initial = session?.admin.name.trim().charAt(0).toUpperCase() || "S";
  const firstName = session?.admin.name.trim().split(/\s+/)[0] ?? "";
  const empty = workplaces?.length === 0;

  return (
    <Page
      header={
        <Cover>
          <View className="flex-row items-center justify-between">
            <Wordmark />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${session?.admin.name ?? "Account"}: account and log out`}
              onPress={() => setMenu(true)}
              hitSlop={6}
              className="flex-row items-center rounded-full border border-rule bg-sheet py-1 pl-1 pr-2.5 active:opacity-70">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-ink">
                <AppText variant="semibold" tone="sheet">
                  {initial}
                </AppText>
              </View>
              {firstName ? (
                <AppText variant="medium" size="sm" numberOfLines={1} className="ml-2 max-w-[110px]">
                  {firstName}
                </AppText>
              ) : null}
              <View className="ml-1">
                <ChevronDown size={16} color={colors.ink2} />
              </View>
            </Pressable>
          </View>
        </Cover>
      }
      refreshing={refreshing}
      onRefresh={refresh}
      dock={
        failed || workplaces == null ? (
          <Button label="Add a workplace" icon="plus" disabled />
        ) : (
          <Button
            label={empty ? "Add your workplace" : "Add a workplace"}
            variant={empty ? "primary" : "line"}
            icon="plus"
            onPress={() => router.push("/new")}
          />
        )
      }
      overlay={
        <BottomSheet visible={menu} onClose={() => setMenu(false)}>
          <AppText variant="display" size="h3">
            {session?.admin.name}
          </AppText>
          <AppText tone="ink2" className="mb-3">
            {session?.admin.email}
          </AppText>
          <View className="border-t border-rule">
            <Row
              left={<GearIcon size={22} />}
              title="Server address"
              subtitle="For setup only"
              right={<ChevronRight />}
              onPress={() => {
                setMenu(false);
                router.push("/server");
              }}
            />
          </View>
          <Button
            label="Log out"
            variant="danger"
            className="mt-4"
            onPress={async () => {
              setMenu(false);
              await logout();
            }}
          />
          <Button label="Close" variant="text" onPress={() => setMenu(false)} />
        </BottomSheet>
      }>
      {pending ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/new")}
          className="mt-5 border-b-2 border-stamp pb-3 active:opacity-70">
          <AppText variant="display" size="h3">
            {pending.draft.name.trim() || "A workplace"}
          </AppText>
          <AppText tone="ink2" className="mt-1">
            Finish setting this up. Your answers are still on this phone.
          </AppText>
        </Pressable>
      ) : null}
      {empty && !pending ? (
        <View className="pt-6">
          <Empty art={<BookArt />} title="Start your book">
            First add your workplace: your shop or workshop. Then add the people who work there.
          </Empty>
        </View>
      ) : !empty ? (
        <View className="pt-5">
          <AppText variant="display" size="title" accessibilityRole="header" className="mb-4">
            Your workplaces
          </AppText>
          {failed ? (
            <LoadError
              title="Couldn't open your workplaces."
              message={problem ?? "Try again."}
              onRetry={load}
            />
          ) : workplaces == null ? (
            <View className="border-t border-rule">
              {[240, 200].map((w) => (
                <View key={w} className="min-h-[76px] justify-center gap-2.5 border-b border-rule py-2.5">
                  <Skeleton width={w} height={22} />
                  <Skeleton width={90} height={16} />
                </View>
              ))}
            </View>
          ) : (
            <View className="border-t border-rule">
              {workplaces.map((workplace) => (
                <Row
                  key={workplace.id}
                  titleStyle="book"
                  title={workplace.name}
                  subtitle={workplace.employeeCount === 0 ? "No people yet" : plural(workplace.employeeCount, "person", "people")}
                  right={<ChevronRight color={colors.ink3} />}
                  onPress={() => {
                    rememberRecent(workplace.id);
                    router.push({ pathname: "/organisation/[id]/choose", params: { id: workplace.id } });
                  }}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </Page>
  );
}


async function readRecent(): Promise<string[]> {
  try {
    const saved = await AsyncStorage.getItem(RECENT_KEY);
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

async function rememberRecent(id: string) {
  const list = (await readRecent()).filter((item) => item !== id);
  list.unshift(id);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20))).catch(() => undefined);
}
