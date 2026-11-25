import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { AppText } from "@/components/app-text";
import { BottomSheet } from "@/components/date-sheet";
import { ChevronDown, StoreIcon, TickIcon } from "@/components/icons";
import { listOrganisations } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { colors } from "@/lib/theme";
import type { OrganisationSummary } from "@/lib/types";

export type OrgSection = "choose" | "employees" | "billing";

const SECTION_PATH = {
  choose: "/organisation/[id]/choose",
  employees: "/organisation/[id]",
  billing: "/organisation/[id]/billing",
} as const;

/**
 * The organisation's name as it appears at the top of every screen inside it.
 * Tapping it lists the other workplaces and opens the same section there.
 */
export function OrgCard({
  name,
  subtitle = "Business Organisation",
  organisationId,
  section = "choose",
}: {
  name: string;
  subtitle?: string;
  organisationId?: string | null;
  section?: OrgSection;
}) {
  const { url } = useServerUrl();
  const [open, setOpen] = useState(false);
  const [workplaces, setWorkplaces] = useState<OrganisationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function show() {
    setOpen(true);
    setFailed(false);
    try {
      setWorkplaces(await listOrganisations(url));
    } catch {
      setFailed(true);
    }
  }

  function pick(id: string) {
    setOpen(false);
    if (id === organisationId) return;
    router.replace({ pathname: SECTION_PATH[section], params: { id } });
  }

  const body = (
    <>
      <View className="h-14 w-14 items-center justify-center rounded-xl bg-off">
        <StoreIcon />
      </View>
      <View className="ml-4 flex-1">
        <AppText variant="bold" size="xl" numberOfLines={2} accessibilityRole="header">
          {name}
        </AppText>
        <AppText tone="ink3" className="mt-0.5" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {organisationId ? (
        <View className="ml-3">
          <ChevronDown size={22} color={colors.ink} />
        </View>
      ) : null}
    </>
  );

  return (
    <>
      {organisationId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${subtitle}. Switch workplace`}
          onPress={show}
          className="flex-row items-center rounded-2xl bg-sheet p-4 active:opacity-80">
          {body}
        </Pressable>
      ) : (
        <View className="flex-row items-center rounded-2xl bg-sheet p-4">{body}</View>
      )}
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <AppText variant="display" size="h3" className="mb-3">
          Switch workplace
        </AppText>
        {failed ? (
          <AppText tone="cloth" className="py-4">
            Workplaces could not be loaded. Check the server, then try again.
          </AppText>
        ) : workplaces === null ? (
          <View className="items-center py-6">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {workplaces.map((workplace) => {
              const current = workplace.id === organisationId;
              return (
                <Pressable
                  key={workplace.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  onPress={() => pick(workplace.id)}
                  className={`mb-2 flex-row items-center rounded-xl px-3 py-3 active:opacity-80 ${current ? "bg-sheet" : ""}`}>
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-off">
                    <StoreIcon size={22} />
                  </View>
                  <AppText variant={current ? "bold" : "medium"} size="lg" className="ml-3 flex-1" numberOfLines={1}>
                    {workplace.name}
                  </AppText>
                  {current ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
                      <TickIcon size={14} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </BottomSheet>
    </>
  );
}
