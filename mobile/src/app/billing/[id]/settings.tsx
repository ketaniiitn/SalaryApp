import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner } from "@/components/book";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { useScreenPad } from "@/components/screen";
import { getBusiness, listItems, updateBusiness } from "@/billing/api";
import { BusinessForm, draftFromBusiness, looseBusinessInput, readBusinessDraft, type BusinessDraft } from "@/billing/business-form";
import { sampleDocument } from "@/billing/draft";
import type { Item } from "@/billing/engine";
import { InvoicePreview } from "@/billing/preview";
import { useServerUrl } from "@/lib/server-url";

export default function BusinessSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const { width } = useWindowDimensions();
  const pad = useScreenPad();
  const wide = width >= 900;
  const [draft, setDraft] = useState<BusinessDraft | null>(null);
  const [nextNumber, setNextNumber] = useState(1);
  const [sample, setSample] = useState<Item | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [business, items] = await Promise.all([getBusiness(url, businessId), listItems(url, businessId)]);
      setDraft((current) => current ?? draftFromBusiness(business));
      setNextNumber(business.nextNumber);
      setSample(items[0]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be opened.");
    }
  }, [businessId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  async function save() {
    if (!draft || !businessId) return;
    const parsed = readBusinessDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      setSaved(false);
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const business = await updateBusiness(url, businessId, parsed.value);
      setDraft(draftFromBusiness(business));
      setSaved(true);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings were not saved.");
    } finally {
      setSaving(false);
    }
  }

  const doc = draft ? sampleDocument({ ...looseBusinessInput(draft), nextNumber }, sample) : null;

  const form = (
    <View className="gap-5">
      <AppText variant="display" size="title">
        Business and invoice settings
      </AppText>
      <AppText tone="ink2">Asked once, printed on every invoice. Changing these does not rewrite invoices you already made.</AppText>
      {saved ? <Banner tone="info">Settings saved.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {draft ? (
        <BusinessForm
          draft={draft}
          nextNumber={nextNumber}
          onChange={(next) => {
            setSaved(false);
            setDraft(next);
          }}
        />
      ) : null}
    </View>
  );

  return (
    <Page
      keyboard
      scroll={false}
      back={{ label: "Billing", fallback: { pathname: "/billing/[id]", params: { id: businessId } } }}
      right={
        wide || !doc ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setView((current) => (current === "edit" ? "preview" : "edit"))}
            className={`rounded-md border-2 border-ink px-3 py-1.5 ${view === "preview" ? "bg-ink" : "bg-paper active:bg-sheet"}`}>
            <AppText variant="semibold" size="sm" tone={view === "preview" ? "sheet" : "ink"}>
              {view === "edit" ? "Preview" : "Edit"}
            </AppText>
          </Pressable>
        )
      }
      dock={<Button label={saving ? "Saving…" : "Save settings"} loading={saving} disabled={!draft} onPress={save} />}>
      {wide && doc ? (
        <View className="flex-1 flex-row">
          <ScrollView style={{ width: Math.min(560, width * 0.46), flexGrow: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 28, paddingTop: 8, paddingBottom: 40 }}>
            {form}
          </ScrollView>
          <View className="flex-1 border-l border-rule bg-sheet px-6 pb-4 pt-2">
            <InvoicePreview doc={doc} note="A sample invoice with your settings." />
          </View>
        </View>
      ) : view === "preview" && doc ? (
        <View className="flex-1 pb-3 pt-1" style={{ paddingHorizontal: pad }}>
          <InvoicePreview doc={doc} note="A sample invoice with your settings." />
        </View>
      ) : (
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 32 }}>
          {form}
        </ScrollView>
      )}
    </Page>
  );
}
