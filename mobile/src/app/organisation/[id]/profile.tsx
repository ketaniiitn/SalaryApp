import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, LoadError } from "@/components/book";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { getOrganisation, isOffline, updateOrganisation } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { AddressFields, CompanyFields, ContactFields } from "@/organisation/form";
import { draftFromProfile, fieldErrors, toProfile, type OrganisationDraft } from "@/organisation/profile";

export default function WorkplaceProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const organisationId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [draft, setDraft] = useState<OrganisationDraft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof OrganisationDraft, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organisationId) return;
    try {
      const organisation = await getOrganisation(url, organisationId);
      setDraft(draftFromProfile(organisation));
      setProblem(null);
    } catch (caught) {
      setProblem(
        isOffline(caught)
          ? "The phone could not reach the server."
          : caught instanceof Error
            ? caught.message
            : "These details could not be opened.",
      );
    }
  }, [organisationId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  function edit(next: OrganisationDraft) {
    setDraft(next);
    setSaved(false);
    setSaveError(null);
    if (Object.keys(errors).length > 0) setErrors({});
  }

  async function save() {
    if (!draft || !organisationId) return;
    const problems = fieldErrors(draft);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setSaved(false);
      setSaveError(null);
      return;
    }
    const profile = toProfile(draft);
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateOrganisation(url, organisationId, profile);
      setDraft(draftFromProfile(updated));
      setSaved(true);
      setSaveError(null);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The details were not saved.");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page
      keyboard
      back={{ label: "Choose", fallback: { pathname: "/organisation/[id]/choose", params: { id: organisationId } } }}
      onRefresh={load}
      refreshing={false}
      dock={<Button label={saving ? "Saving…" : "Save workplace"} loading={saving} disabled={!draft} onPress={save} />}>
      <View>
        <AppText variant="display" size="title" accessibilityRole="header">
          Workplace details
        </AppText>
        <AppText tone="ink2" className="mt-2">
          Billing and the employee side start from this page. Bills you already made stay as they were.
        </AppText>
      </View>
      {problem ? <LoadError title="Couldn't open the workplace details." message={problem} onRetry={load} /> : null}
      {saveError ? <Banner title="Couldn't save the workplace.">{saveError}</Banner> : null}
      {saved ? <Banner tone="calm" title="Saved.">These details are ready for the next bill.</Banner> : null}
      {draft ? (
        <View>
          <AppText variant="display" size="h3" className="mb-3">
            The workplace
          </AppText>
          <CompanyFields draft={draft} errors={errors} onChange={edit} />
          <AppText variant="display" size="h3" className="mb-3">
            The address
          </AppText>
          <AddressFields draft={draft} errors={errors} onChange={edit} />
          <AppText variant="display" size="h3" className="mb-3">
            Who to call
          </AppText>
          <ContactFields draft={draft} errors={errors} onChange={edit} />
        </View>
      ) : null}
    </Page>
  );
}
