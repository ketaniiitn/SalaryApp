import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner } from "@/components/book";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { createOrganisation } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { useSession } from "@/lib/session";
import { AddressFields, CompanyFields, ContactFields, ReviewList } from "@/organisation/form";
import {
  blankDraft,
  clearSetup,
  errorsForStep,
  loadSetup,
  saveSetup,
  toProfile,
  type OrganisationDraft,
  type SetupStep,
} from "@/organisation/profile";

const QUESTIONS: Record<SetupStep, string> = {
  1: "What is this workplace?",
  2: "Where is it?",
  3: "Who should we call?",
  4: "Check the details",
};

export default function NewWorkplaceScreen() {
  const { url } = useServerUrl();
  const { session } = useSession();
  const admin = session?.admin;
  const [step, setStep] = useState<SetupStep>(1);
  const [draft, setDraft] = useState<OrganisationDraft | null>(null);
  const [reachedReview, setReachedReview] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof OrganisationDraft, string>>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    loadSetup(admin.id).then((saved) => {
      if (!active) return;
      setDraft(saved?.draft ?? blankDraft(admin));
      setStep(saved?.step ?? 1);
      setReachedReview((saved?.step ?? 1) === 4);
    });
    return () => {
      active = false;
    };
  }, [admin]);

  useEffect(() => {
    if (!admin || !draft) return;
    saveSetup(admin.id, { step, draft });
  }, [admin, draft, step]);

  function edit(next: OrganisationDraft) {
    setDraft(next);
    if (Object.keys(errors).length > 0) setErrors({});
  }

  function backOne() {
    setErrors({});
    setFailed(null);
    setStep((current) => (current > 1 ? ((current - 1) as SetupStep) : current));
  }

  async function continueStep() {
    if (!draft || !admin) return;
    const problems = errorsForStep(step, draft);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setErrors({});
    setFailed(null);
    if (step === 4) {
      const profile = toProfile(draft);
      if (!profile) return;
      setSaving(true);
      try {
        const created = await createOrganisation(url, profile);
        await clearSetup(admin.id);
        router.replace({ pathname: "/organisation/[id]/choose", params: { id: created.id } });
      } catch (caught) {
        setFailed(caught instanceof Error ? caught.message : "The workplace was not created.");
        setSaving(false);
      }
      return;
    }
    if (reachedReview) {
      setStep(4);
      return;
    }
    const following = (step + 1) as SetupStep;
    if (following === 4) setReachedReview(true);
    setStep(following);
  }

  const question = QUESTIONS[step];

  return (
    <Page
      keyboard
      back={{ label: "Home", fallback: "/", onPress: () => router.replace("/") }}
      dock={
        draft ? (
          <View className="gap-1">
            {step > 1 ? <Button label="Back" variant="text" onPress={backOne} /> : null}
            <Button
              label={step === 4 ? (saving ? "Opening…" : "Open workplace") : "Continue"}
              loading={saving}
              onPress={continueStep}
            />
          </View>
        ) : null
      }>
      <View>
        <View className="h-[3px] overflow-hidden rounded-full bg-rule">
          <View className="h-[3px] bg-stamp" style={{ width: `${step * 25}%` }} />
        </View>
        <AppText tone="ink3" className="mt-3">
          {`Step ${step} of 4`}
        </AppText>
        <AppText variant="display" size="title" accessibilityRole="header" className="mt-1">
          {question}
        </AppText>
      </View>
      {failed ? <Banner title="Couldn't create it.">{failed}</Banner> : null}
      {draft && step === 1 ? <CompanyFields draft={draft} errors={errors} onChange={edit} /> : null}
      {draft && step === 2 ? <AddressFields draft={draft} errors={errors} onChange={edit} /> : null}
      {draft && step === 3 ? <ContactFields draft={draft} errors={errors} onChange={edit} /> : null}
      {draft && step === 4 ? (
        <ReviewList
          draft={draft}
          onEdit={(section) => {
            setErrors({});
            setStep(section);
          }}
        />
      ) : null}
    </Page>
  );
}
