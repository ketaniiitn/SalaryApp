import { router, useLocalSearchParams, usePreventRemove, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner } from "@/components/book";
import { Button } from "@/components/button";
import { DateSheet } from "@/components/date-sheet";
import { Field, PickerField } from "@/components/field";
import { Page } from "@/components/page";
import { DaysWorkedField, SalaryField, WorkingDaysField, daysSinceJoining, earnedPreview, readRupees } from "@/components/pay-fields";
import { createEmployee, getOrganisation } from "@/lib/api";
import { firstName, formatDay, formatRupees, formatShortDate, plural, todayIso, type SalaryBasis } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";

type Problems = { name?: string; role?: string; salary?: string; worked?: string; save?: string };

export default function AddPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const organisationId = Array.isArray(id) ? id[0] : id;
  const { url } = useServerUrl();
  const navigation = useNavigation();
  const [workplaceName, setWorkplaceName] = useState("Workplace");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [basis, setBasis] = useState<SalaryBasis>("month");
  const [salaryText, setSalaryText] = useState("");
  const [workingDays, setWorkingDays] = useState(26);
  const [worked, setWorked] = useState(0);
  const [joinedOn, setJoinedOn] = useState(todayIso());
  const [picking, setPicking] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [saving, setSaving] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (!organisationId) return;
    getOrganisation(url, organisationId)
      .then((workplace) => setWorkplaceName(workplace.name))
      .catch(() => undefined);
  }, [organisationId, url]);

  // Leave once the leave-guard has been switched off by the re-render.
  useEffect(() => {
    if (!addedId || !organisationId) return;
    router.dismissTo({ pathname: "/organisation/[id]", params: { id: organisationId, added: addedId } });
  }, [addedId, organisationId]);

  const typed = Boolean(name.trim() || role.trim() || salaryText);
  usePreventRemove(typed && !addedId, ({ data }) => {
    Alert.alert(name.trim() ? `Leave without adding ${firstName(name)}?` : "Leave without adding this person?", undefined, [
      { text: "Keep adding", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const salary = readRupees(salaryText);
  const sinceJoining = daysSinceJoining(joinedOn);
  const workedTooMany =
    worked > sinceJoining
      ? sinceJoining === 0
        ? "They haven't joined yet, so this must be 0. Change the joining date, or lower this."
        : `Only ${plural(sinceJoining, "day", "days")} since they joined on ${formatShortDate(joinedOn)}. Change the joining date, or lower this.`
      : null;
  // A monthly salary pays at most the working days; a day wage pays every day present.
  const counted = basis === "month" ? Math.min(worked, workingDays) : worked;
  const earned = earnedPreview({ salary, basis, workingDays, daysPresent: worked });

  async function save() {
    const found: Problems = {};
    if (!name.trim()) found.name = "Write their name.";
    if (!role.trim()) found.role = "Write the work they do, like welder or helper.";
    if (salary == null) found.salary = "Write the salary.";
    if (workedTooMany) found.worked = workedTooMany;
    setProblems(found);
    if (Object.keys(found).length > 0 || salary == null || !organisationId) return;

    setSaving(true);
    try {
      const created = await createEmployee(url, organisationId, {
        name: name.trim(),
        role: role.trim(),
        salary,
        salaryBasis: basis,
        workingDays,
        daysWorked: counted,
        joinedOn,
      });
      setAddedId(created.id);
    } catch (caught) {
      setProblems({ save: caught instanceof Error ? caught.message : "Couldn't add them. Try again." });
      setSaving(false);
    }
  }

  return (
    <Page
      keyboard
      back={{ label: workplaceName, fallback: { pathname: "/organisation/[id]", params: { id: organisationId } } }}
      dock={
        <>
          <View accessible accessibilityLiveRegion="polite" className="gap-0.5 rounded-md border-2 border-dashed border-ink3 bg-sheet px-4 py-3">
            <AppText variant="bold" tone="ink2">
              Earned so far this month
            </AppText>
            <AppText variant="display" size="md">
              {formatRupees(earned)}
            </AppText>
            <AppText size="sm" tone="ink3">
              {`${plural(counted, "day", "days")} worked. Before any money given.`}
            </AppText>
          </View>
          <Button label={saving ? "Adding…" : "Add person"} loading={saving} onPress={save} className="mt-1.5" />
        </>
      }
      overlay={
        <DateSheet
          visible={picking}
          title="Joined on"
          value={joinedOn}
          onPick={setJoinedOn}
          onClose={() => setPicking(false)}
        />
      }>
      <AppText variant="display" size="title" accessibilityRole="header">
        Add person
      </AppText>
      <View>
        {problems.save ? (
          <View className="mb-5">
            <Banner title="Couldn't add them.">{problems.save}</Banner>
          </View>
        ) : null}
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          maxLength={80}
          error={problems.name}
        />
        <Field
          label="Work they do"
          value={role}
          onChangeText={setRole}
          autoCapitalize="sentences"
          maxLength={80}
          hint="For example welder, helper, cashier."
          error={problems.role}
        />
        <SalaryField basis={basis} onBasis={setBasis} salaryText={salaryText} onSalaryText={setSalaryText} error={problems.salary} />
        <WorkingDaysField
          value={workingDays}
          onChange={(next) => {
            setWorkingDays(next);
            if (basis === "month") setWorked((current) => Math.min(current, next));
          }}
        />
        <DaysWorkedField value={worked} max={basis === "month" ? workingDays : 31} onChange={setWorked} error={problems.worked ?? (worked > 0 ? workedTooMany : null)} />
        <PickerField
          label="Joined on"
          kind="date"
          value={joinedOn === todayIso() ? `Today, ${formatDay(joinedOn)}` : formatDay(joinedOn)}
          hint="Starts as today. They can't be marked present before this day."
          onPress={() => setPicking(true)}
        />
      </View>
    </Page>
  );
}
