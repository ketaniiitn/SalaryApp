import { router } from "expo-router";
import { useState } from "react";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { createBusiness } from "@/billing/api";
import { BusinessForm, emptyBusinessDraft, readBusinessDraft, type BusinessDraft } from "@/billing/business-form";
import { useServerUrl } from "@/lib/server-url";

export default function NewBusinessScreen() {
  const { url } = useServerUrl();
  const [draft, setDraft] = useState<BusinessDraft>(emptyBusinessDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = readBusinessDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createBusiness(url, parsed.value);
      router.replace({ pathname: "/billing/[id]", params: { id: created.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The business was not saved.");
      setSaving(false);
    }
  }

  return (
    <Page
      keyboard
      back={{ label: "Bills", fallback: "/billing" }}
      dock={<Button label={saving ? "Saving…" : "Save business"} loading={saving} onPress={save} />}>
      <AppText variant="display" size="title">
        Your business
      </AppText>
      <AppText tone="ink2">Fill this once. Every bill after that uses these details.</AppText>
      {error ? <AppText tone="cloth">{error}</AppText> : null}
      <BusinessForm draft={draft} onChange={setDraft} />
    </Page>
  );
}
