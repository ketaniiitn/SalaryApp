import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { LoadError, Row } from "@/components/book";
import { Button } from "@/components/button";
import { ChevronRight } from "@/components/icons";
import { Page } from "@/components/page";
import { listBusinesses } from "@/billing/api";
import type { Business } from "@/billing/engine";
import { isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

export default function BillingHomeScreen() {
  const { url, ready } = useServerUrl();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBusinesses(await listBusinesses(url));
      setProblem(null);
    } catch (caught) {
      setBusinesses(null);
      setProblem(messageFrom(caught));
    }
  }, [url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  const empty = businesses?.length === 0;

  return (
    <Page
      back={{ label: "Home", fallback: "/" }}
      onRefresh={load}
      refreshing={false}
      dock={<Button label={empty ? "Set up your business" : "Add another business"} icon="plus" onPress={() => router.push("/billing/new")} />}>
      <AppText variant="display" size="title">
        Bills
      </AppText>
      <AppText tone="ink2">Make a bill, let the app work out GST, and keep every bill here.</AppText>
      {problem ? <LoadError title="Couldn't open bills." message={problem} onRetry={load} /> : null}
      {empty ? (
        <AppText>Start with the shop or service that sends the bills. You can add another later.</AppText>
      ) : (
        <View className="border-t border-rule">
          {businesses?.map((business) => (
            <Row
              key={business.id}
              titleStyle="book"
              title={business.name}
              subtitle={business.gstRegistered ? `GSTIN ${business.gstin}` : "No GST on bills"}
              right={<ChevronRight />}
              onPress={() => router.push({ pathname: "/billing/[id]", params: { id: business.id } })}
            />
          ))}
        </View>
      )}
    </Page>
  );
}

function messageFrom(caught: unknown): string {
  if (isOffline(caught)) return "The phone could not reach the server. Check the server address.";
  return caught instanceof Error ? caught.message : "Bills could not be opened.";
}
