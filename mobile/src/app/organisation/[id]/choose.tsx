import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { LoadError, Skeleton } from "@/components/book";
import { BuildingIcon, GroupIcon, HomeIcon, ReceiptIcon } from "@/components/icons";
import { OrgCard } from "@/components/org-card";
import { Page } from "@/components/page";
import { getOrganisation, isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { colors } from "@/lib/theme";

export default function ChooseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const organisationId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [name, setName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    try {
      const organisation = await getOrganisation(url, organisationId);
      setName(organisation.name);
      setProblem(null);
    } catch (caught) {
      setProblem(
        isOffline(caught)
          ? "The phone could not reach the server."
          : caught instanceof Error
            ? caught.message
            : "That workplace could not be opened.",
      );
    }
  }, [organisationId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  return (
    <Page back={{ label: "Home", fallback: "/" }} onRefresh={load} refreshing={false}>
      {problem ? <LoadError title="Couldn't open this workplace." message={problem} onRetry={load} /> : null}
      {!name && !problem ? <Skeleton width="100%" height={360} /> : null}
      {name ? (
        <View>
          <OrgCard name={name} organisationId={organisationId} section="choose" />
          <AppText tone="ink2" className="mt-6">
            What do you want to open?
          </AppText>
          <View className="mt-4 gap-4">
            <View className="flex-row gap-4">
              <Tile
                label={"Billing\nand invoices"}
                icon={<ReceiptIcon />}
                onPress={() => router.push({ pathname: "/organisation/[id]/billing", params: { id: organisationId } })}
              />
              <Tile
                label={"Employee\nportal"}
                icon={<GroupIcon />}
                onPress={() => router.push({ pathname: "/organisation/[id]", params: { id: organisationId } })}
              />
            </View>
            <View className="flex-row gap-4">
              <Tile
                label={"Workplace\ndetails"}
                icon={<BuildingIcon />}
                onPress={() => router.push({ pathname: "/organisation/[id]/profile", params: { id: organisationId } })}
              />
              <Tile label={"All\nworkplaces"} icon={<HomeIcon />} onPress={() => router.replace("/")} />
            </View>
          </View>
        </View>
      ) : null}
    </Page>
  );
}

function Tile({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace("\n", " ")}
      onPress={onPress}
      className="flex-1 items-center justify-center rounded-2xl bg-sheet px-3 active:opacity-80"
      style={{
        aspectRatio: 0.95,
        shadowColor: colors.ink,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}>
      {icon}
      <AppText variant="medium" className="mt-5 text-center">
        {label}
      </AppText>
    </Pressable>
  );
}
