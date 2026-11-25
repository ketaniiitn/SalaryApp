import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, LoadError, Skeleton } from "@/components/book";
import { Button } from "@/components/button";
import { DateSheet } from "@/components/date-sheet";
import { PickerField } from "@/components/field";
import { Page } from "@/components/page";
import { SalaryField, WorkingDaysField, earnedPreview, readRupees } from "@/components/pay-fields";
import { getOrganisation, updateEmployee } from "@/lib/api";
import { formatDay, formatRupees, monthName, todayIso, type SalaryBasis } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";
import type { Employee } from "@/lib/types";

function groupDigits(value: number): string {
  return formatRupees(value).slice(1);
}

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ id: string; employeeId: string }>();
  const organisationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const personId = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
  const { url, ready } = useServerUrl();
  const navigation = useNavigation();
  const [person, setPerson] = useState<Employee | null>(null);
  const [failed, setFailed] = useState(false);
  const [basis, setBasis] = useState<SalaryBasis>("month");
  const [salaryText, setSalaryText] = useState("");
  const [workingDays, setWorkingDays] = useState(26);
  const [joinedOn, setJoinedOn] = useState(todayIso());
  const [picking, setPicking] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const filled = useRef(false);

  const load = useCallback(async () => {
    if (!organisationId || !personId) return;
    try {
      const workplace = await getOrganisation(url, organisationId);
      const found = workplace.employees.find((item) => item.id === personId);
      if (!found) throw new Error("missing");
      // Fill the form once; don't overwrite what the owner is typing when the screen regains focus.
      if (!filled.current) {
        filled.current = true;
        setPerson(found);
        setBasis(found.salaryBasis);
        setSalaryText(groupDigits(found.salary));
        setWorkingDays(found.workingDays);
        setJoinedOn(found.joinedOn);
      }
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [organisationId, personId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  const salary = readRupees(salaryText);
  const changed =
    person != null &&
    (basis !== person.salaryBasis || salary !== Math.round(person.salary) || workingDays !== person.workingDays || joinedOn !== person.joinedOn);

  usePreventRemove(changed && !leaving, ({ data }) => {
    Alert.alert("Leave without saving?", undefined, [
      { text: "Keep editing", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useEffect(() => {
    if (!leaving || !organisationId || !personId) return;
    router.dismissTo({ pathname: "/organisation/[id]/employee/[employeeId]", params: { id: organisationId, employeeId: personId, saved: "1" } });
  }, [leaving, organisationId, personId]);

  async function save() {
    if (!person || !organisationId || !personId) return;
    if (salary == null) {
      setSalaryError("Write the salary.");
      return;
    }
    setSalaryError(null);
    setSaveError(null);
    setSaving(true);
    try {
      await updateEmployee(url, organisationId, personId, {
        salary,
        salaryBasis: basis,
        workingDays,
        joinedOn,
      });
      setLeaving(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Check the internet and try again.");
      setSaving(false);
    }
  }

  const before = person ? Math.round(person.earned) : 0;
  const after = person ? earnedPreview({ salary, basis, workingDays, daysPresent: person.daysPresent }) : 0;

  return (
    <Page
      keyboard
      back={{
        label: person?.name ?? "Person",
        fallback: { pathname: "/organisation/[id]/employee/[employeeId]", params: { id: organisationId, employeeId: personId } },
      }}
      dock={<Button label={saving ? "Saving…" : "Save changes"} loading={saving} disabled={!changed} onPress={save} />}
      overlay={
        <DateSheet
          visible={picking}
          title="Joined on"
          value={joinedOn}
          onPick={setJoinedOn}
          onClose={() => setPicking(false)}
        />
      }>
      <View>
        <AppText variant="bold" size="xs" tone="ink3" style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
          Profile
        </AppText>
        <AppText variant="display" size="title" accessibilityRole="header">
          {person?.name ?? " "}
        </AppText>
      </View>

      {failed && !person ? (
        <LoadError title="Couldn't open this profile." message="Check the internet, then try again." onRetry={load} />
      ) : !person ? (
        <View className="gap-4">
          <Skeleton width="100%" height={54} />
          <Skeleton width="100%" height={58} />
          <Skeleton width="100%" height={58} />
          <Skeleton width="100%" height={58} />
        </View>
      ) : (
        <View>
          {saveError ? (
            <View className="mb-5">
              <Banner title="Couldn't save.">{saveError}</Banner>
            </View>
          ) : null}
          <SalaryField
            basis={basis}
            onBasis={setBasis}
            salaryText={salaryText}
            onSalaryText={(text) => {
              setSalaryText(text);
              setSalaryError(null);
            }}
            error={salaryError}
          />
          <WorkingDaysField value={workingDays} onChange={setWorkingDays} />
          <PickerField label="Joined on" kind="date" value={formatDay(joinedOn)} onPress={() => setPicking(true)} />
          {changed && salary != null && after !== before ? (
            <View className="rounded-xl bg-sheet px-3.5 py-3">
              <AppText size="sm" tone="ink3">
                {`With this change, ${monthName(todayIso())} so far becomes `}
                <AppText variant="bold" size="sm">{`${formatRupees(after)} earned`}</AppText>
                {` (was ${formatRupees(before)}).`}
              </AppText>
            </View>
          ) : null}
        </View>
      )}
    </Page>
  );
}
