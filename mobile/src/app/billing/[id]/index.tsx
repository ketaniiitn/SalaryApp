import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Leader, LoadError, Row, Total } from "@/components/book";
import { Button } from "@/components/button";
import { ChevronRight } from "@/components/icons";
import { OrgCard } from "@/components/org-card";
import { Page } from "@/components/page";
import { getBusiness, getSummary } from "@/billing/api";
import { draftHasWork, loadDraft, type BillDraft } from "@/billing/draft";
import { formatMoney, type Business, type MonthSummary } from "@/billing/engine";
import { isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

export default function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [business, setBusiness] = useState<Business | null>(null);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState<BillDraft | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [nextBusiness, nextSummary, nextDraft] = await Promise.all([getBusiness(url, businessId), getSummary(url, businessId), loadDraft(businessId)]);
      setBusiness(nextBusiness);
      setSummary(nextSummary);
      setDraft(draftHasWork(nextDraft) ? nextDraft : null);
      setProblem(null);
    } catch (caught) {
      setProblem(isOffline(caught) ? "The phone could not reach the server." : caught instanceof Error ? caught.message : "This business could not be opened.");
    }
  }, [businessId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  return (
    <Page
      back={{
        label: "Choose",
        fallback: business?.organisationId
          ? { pathname: "/organisation/[id]/choose", params: { id: business.organisationId } }
          : "/billing",
      }}
      onRefresh={load}
      refreshing={false}
      dock={
        <Button
          label="New invoice"
          icon="plus"
          disabled={!business}
          onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId } })}
        />
      }>
      {problem ? <LoadError title="Couldn't open this business." message={problem} onRetry={load} /> : null}
      {business && summary ? (
        <View>
          <OrgCard name={business.name} subtitle="Billing" organisationId={business.organisationId} section="billing" />
          <AppText tone="ink2" className="mt-3">
            {business.gstRegistered ? `GSTIN ${business.gstin}` : "Bills do not add GST"}
          </AppText>
          <View className="mt-6">
            <Total label="Billed this month" amount={summary.total} />
            <View className="mt-4">
              <Leader label="Invoices" value={String(summary.count)} />
              <Leader label="Still to collect" value={formatMoney(summary.outstanding)} />
              <Leader label="Taxable" value={formatMoney(summary.taxable)} />
              <Leader label="GST" value={formatMoney(summary.tax)} />
            </View>
          </View>
          <View className="mt-6 border-t border-rule">
            {draft ? (
              <Row
                title="Continue unsaved invoice"
                subtitle={draft.buyer.name ? `For ${draft.buyer.name}, ${draft.lines.length} ${draft.lines.length === 1 ? "item" : "items"}` : "Kept on this phone"}
                highlight
                right={<ChevronRight />}
                onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId } })}
              />
            ) : null}
            <Row title="Invoices" subtitle="Search, share, payments" right={<ChevronRight />} onPress={() => router.push({ pathname: "/billing/[id]/history", params: { id: businessId } })} />
            <Row title="Saved items" subtitle="Prices and GST rates you use often" right={<ChevronRight />} onPress={() => router.push({ pathname: "/billing/[id]/items", params: { id: businessId } })} />
            <Row title="Business settings" subtitle="Business details, invoice look, numbering" right={<ChevronRight />} onPress={() => router.push({ pathname: "/billing/[id]/settings", params: { id: businessId } })} />
          </View>
        </View>
      ) : null}
    </Page>
  );
}
