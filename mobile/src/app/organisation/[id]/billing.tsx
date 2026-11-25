import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { billingForOrganisation, createBillingForOrganisation } from "@/billing/api";
import { isIndianState } from "@/billing/engine";
import { BusinessForm, emptyBusinessDraft, readBusinessDraft, type BusinessDraft } from "@/billing/business-form";
import { getOrganisation } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

export default function OrganisationBillingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const organisationId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [draft, setDraft] = useState<BusinessDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const existing = await billingForOrganisation(url, organisationId);
    if (existing) {
      router.replace({ pathname: "/billing/[id]", params: { id: existing.id } });
      return;
    }
    const organisation = await getOrganisation(url, organisationId);
    const address = [organisation.address, organisation.city, organisation.postalCode].filter(Boolean).join(", ");
    setDraft({
      ...emptyBusinessDraft,
      name: organisation.name,
      category: organisation.industry,
      address,
      state: isIndianState(organisation.state) ? organisation.state : "",
      phone: organisation.phone,
      email: organisation.email,
    });
    setError(null);
  }, [organisationId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load().catch((caught) => setError(caught instanceof Error ? caught.message : "Billing could not be opened."));
    }, [load, ready]),
  );

  async function save() {
    if (!draft || !organisationId) return;
    const parsed = readBusinessDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createBillingForOrganisation(url, organisationId, parsed.value);
      router.replace({ pathname: "/billing/[id]", params: { id: created.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing was not saved.");
      setSaving(false);
    }
  }

  return (
    <Page
      keyboard
      back={{ label: "Choose", fallback: { pathname: "/organisation/[id]/choose", params: { id: organisationId } } }}
      dock={<Button label={saving ? "Saving…" : "Save and start billing"} loading={saving} disabled={!draft} onPress={save} />}>
      <AppText variant="display" size="title">
        Set up billing
      </AppText>
      <AppText tone="ink2">This is once for this workplace. After this, every invoice fills these details in for you.</AppText>
      {error ? <AppText tone="cloth">{error}</AppText> : null}
      {draft ? <BusinessForm draft={draft} onChange={setDraft} setup /> : null}
    </Page>
  );
}
