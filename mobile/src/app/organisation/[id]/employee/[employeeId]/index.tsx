import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { AheadStamp, Banner, Leader, LoadError, Skeleton, Stamp, Total } from "@/components/book";
import { Button } from "@/components/button";
import { MonthGrid, type DayState } from "@/components/month-calendar";
import { Page } from "@/components/page";
import { getAttendance, getEmployeeMonth, getOrganisation, saveAttendance } from "@/lib/api";
import { formatDay, formatRupees, monthName, shiftMonth, todayIso } from "@/lib/pay";
import type { Employee, EmployeeMonth } from "@/lib/types";
import { useServerUrl } from "@/lib/server-url";

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string; employeeId: string; saved?: string }>();
  const organisationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const personId = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
  const { url, ready } = useServerUrl();
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const [workplaceName, setWorkplaceName] = useState("Workplace");
  const [person, setPerson] = useState<Employee | null>(null);
  const [month, setMonth] = useState(thisMonth);
  const [record, setRecord] = useState<EmployeeMonth | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [dayFailed, setDayFailed] = useState<string | null>(null);
  const [savedStamp, setSavedStamp] = useState(false);

  useEffect(() => {
    if (params.saved !== "1") return;
    setSavedStamp(true);
    router.setParams({ saved: undefined });
    const timer = setTimeout(() => setSavedStamp(false), 2000);
    return () => clearTimeout(timer);
  }, [params.saved]);

  const loadPerson = useCallback(async () => {
    if (!organisationId || !personId) return;
    const workplace = await getOrganisation(url, organisationId);
    setWorkplaceName(workplace.name);
    const found = workplace.employees.find((item) => item.id === personId);
    if (!found) throw new Error("missing");
    setPerson(found);
  }, [organisationId, personId, url]);

  const loadMonth = useCallback(async () => {
    if (!organisationId || !personId) return;
    setRecord(await getEmployeeMonth(url, organisationId, personId, month));
  }, [month, organisationId, personId, url]);

  const load = useCallback(async () => {
    try {
      await Promise.all([loadPerson(), loadMonth()]);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [loadMonth, loadPerson]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  const joinedOn = record?.joinedOn ?? person?.joinedOn ?? today;
  const notJoined = joinedOn > today;
  const present = new Set(record?.month === month ? record.presentDates : []);

  function dayState(iso: string): DayState {
    if (iso === joinedOn && notJoined) return "join";
    if (iso > today || iso < joinedOn) return "faded";
    return present.has(iso) ? "present" : "away";
  }

  /** Switch one day. The calendar changes at once; the numbers follow when the server answers. */
  async function toggle(iso: string) {
    if (!organisationId || !personId || !record || pending.has(iso)) return;
    const wasPresent = present.has(iso);
    setDayFailed(null);
    setPending((current) => new Set(current).add(iso));
    setRecord({
      ...record,
      presentDates: wasPresent ? record.presentDates.filter((d) => d !== iso) : [...record.presentDates, iso],
    });
    try {
      const sheet = await getAttendance(url, organisationId, iso);
      const ids = sheet.employees
        .filter((item) => (item.id === personId ? !wasPresent : item.present) && iso >= item.joinedOn)
        .map((item) => item.id);
      await saveAttendance(url, organisationId, iso, ids);
      await Promise.all([loadPerson(), loadMonth()]);
    } catch {
      setDayFailed(iso);
      await loadMonth().catch(() => undefined);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(iso);
        return next;
      });
    }
  }

  // Pay for the month on screen, so last month can still be settled after it ends.
  const shown = record?.month === month ? record : null;
  const isThisMonth = month === thisMonth;
  const payable = shown ? Math.round(shown.payable) : 0;
  const rate = person ? `${formatRupees(person.salary)} ${person.salaryBasis === "day" ? "a day" : "a month"}` : "";

  return (
    <Page
      back={{ label: workplaceName, fallback: { pathname: "/organisation/[id]", params: { id: organisationId } } }}
      right={savedStamp ? <Stamp label="Saved" tick /> : null}
      dock={
        <View className="flex-row gap-2.5">
          <Button
            label="Money given"
            className="flex-1"
            disabled={!person}
            onPress={() =>
              router.push({ pathname: "/organisation/[id]/employee/[employeeId]/advances", params: { id: organisationId, employeeId: personId } })
            }
          />
          <Button
            label="Profile"
            variant="line"
            className="flex-1"
            disabled={!person}
            onPress={() =>
              router.push({ pathname: "/organisation/[id]/employee/[employeeId]/settings", params: { id: organisationId, employeeId: personId } })
            }
          />
        </View>
      }>
      <View>
        <AppText variant="display" size="title" accessibilityRole="header">
          {person?.name ?? " "}
        </AppText>
        {person ? <AppText tone="ink2">{`${person.role} · ${rate}`}</AppText> : null}
      </View>

      {failed && !person ? (
        <LoadError title="Couldn't open this page." message="Their marks and money are safe. Check the internet, then try again." onRetry={load} />
      ) : !person || !record ? (
        <View className="gap-3">
          <AppText variant="bold" size="lg" tone="ink2">
            Still to pay
          </AppText>
          <Skeleton width={200} height={56} />
          <Skeleton width="100%" height={18} />
          <Skeleton width="100%" height={18} />
          <Skeleton width="100%" height={300} className="mt-2 rounded-md" />
        </View>
      ) : (
        <>
          {notJoined ? (
            <View className="gap-2">
              <Banner tone="info" title={`Joins on ${formatDay(joinedOn)}.`}>
                Nothing is counted before that day, so there is nothing to pay yet.
              </Banner>
              <View className="mt-2 gap-1">
                <Leader label="Earned this month" value={formatRupees(0)} />
                <Leader label="Days present" value={`0 of ${person.workingDays}`} />
              </View>
            </View>
          ) : !shown ? (
            <View className="gap-3">
              <Skeleton width={200} height={56} />
              <Skeleton width="100%" height={18} />
              <Skeleton width="100%" height={18} />
            </View>
          ) : (
            <View className="gap-2">
              {payable < 0 ? (
                <>
                  <AheadStamp amount={-payable} big />
                  <AppText tone="ink2" size="sm" className="mt-1">
                    {`${formatRupees(-payable)} more than earned so far. Nothing to pay now.`}
                  </AppText>
                </>
              ) : (
                <Total label={isThisMonth ? "Still to pay" : `Still to pay for ${monthName(month)}`} amount={payable} />
              )}
              <View className="mt-1.5 gap-1">
                <Leader label={isThisMonth ? "Earned this month" : `Earned in ${monthName(month)}`} value={formatRupees(shown.earned)} />
                <Leader label={isThisMonth ? "Money given" : `Money given in ${monthName(month)}`} value={formatRupees(shown.given)} />
                <Leader label="Days present" value={`${shown.daysPresent} of ${shown.workingDays}`} />
              </View>
            </View>
          )}

          <View className="gap-1.5">
            <MonthGrid
              month={month}
              today={today}
              dayState={dayState}
              onDayPress={toggle}
              isPending={(iso) => pending.has(iso)}
              onPrev={() => setMonth((m) => shiftMonth(m, -1))}
              onNext={() => setMonth((m) => shiftMonth(m, 1))}
              canPrev={month > joinedOn.slice(0, 7)}
              canNext={month < thisMonth}
            />
            {dayFailed ? (
              <Banner title={`${formatDay(dayFailed)} didn't save.`}>No internet right now. Tap the day again to retry.</Banner>
            ) : month === thisMonth ? (
              <Legend />
            ) : (
              <AppText variant="semibold" size="sm" tone="stamp">
                {`${monthName(month)} is kept in the book. Changes here don't change ${monthName(thisMonth)}'s pay.`}
              </AppText>
            )}
          </View>
        </>
      )}
    </Page>
  );
}

function Legend() {
  return (
    <View className="flex-row flex-wrap gap-x-[18px] gap-y-2" accessibilityLabel="Solid circle: present. Dashed circle: not here. Faded number: not counted. Tap a day to change it.">
      <LegendItem swatch="present" label="Present" />
      <LegendItem swatch="away" label="Not here" />
      <LegendItem swatch="faded" label="Not counted" />
      <AppText size="sm" tone="ink3">
        Tap a day to change it.
      </AppText>
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: "present" | "away" | "faded"; label: string }) {
  const style =
    swatch === "present"
      ? "bg-ink"
      : swatch === "away"
        ? "border-2 border-dashed border-ink3"
        : "border-[1.5px] border-rule2";
  return (
    <View className="flex-row items-center">
      <View className={`h-5 w-5 rounded-full ${style}`} />
      <AppText variant="medium" size="sm" tone="ink2" className="ml-1.5">
        {label}
      </AppText>
    </View>
  );
}
