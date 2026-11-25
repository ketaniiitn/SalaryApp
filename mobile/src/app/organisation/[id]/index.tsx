import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, Empty, Leader, LoadError, Mark, Owed, Row, SectionHead, Skeleton, Stamp, Toast, Total } from "@/components/book";
import { Button } from "@/components/button";
import { PeopleArt } from "@/components/icons";
import { OrgCard } from "@/components/org-card";
import { Page, useToastOffset } from "@/components/page";
import { getAttendance, getOrganisation } from "@/lib/api";
import { firstName, formatDay, formatRupees, formatShortDate, monthName, todayIso } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";
import type { AttendanceEmployee, Employee, OrganisationDetail } from "@/lib/types";

export default function WorkplaceScreen() {
  const params = useLocalSearchParams<{ id: string; created?: string; added?: string }>();
  const toastBottom = useToastOffset();
  const [addedId, setAddedId] = useState<string | null>(null);

  // A person just came back from Add person: say so, and light up their row for a moment.
  useEffect(() => {
    if (!params.added) return;
    setAddedId(params.added);
    router.setParams({ added: undefined });
  }, [params.added]);
  const organisationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { url, ready } = useServerUrl();
  const [workplace, setWorkplace] = useState<OrganisationDetail | null>(null);
  const [roster, setRoster] = useState<AttendanceEmployee[] | null>(null);
  const [rosterFailed, setRosterFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justCreated, setJustCreated] = useState(params.created === "1");
  const [refreshing, setRefreshing] = useState(false);
  const today = todayIso();

  useEffect(() => {
    if (!justCreated) return;
    const timer = setTimeout(() => setJustCreated(false), 2000);
    return () => clearTimeout(timer);
  }, [justCreated]);

  const load = useCallback(async () => {
    if (!organisationId) return;
    try {
      const next = await getOrganisation(url, organisationId);
      setWorkplace(next);
      setFailed(false);
    } catch {
      setFailed(true);
      return;
    }
    try {
      const day = await getAttendance(url, organisationId, todayIso());
      setRoster(day.employees);
      setRosterFailed(false);
    } catch {
      setRosterFailed(true);
    }
  }, [organisationId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  const people = workplace ? orderPeople(workplace.employees, today) : [];
  const joined = people.filter((person) => person.joinedOn <= today);
  const presentIds = new Set(roster?.filter((person) => person.present).map((person) => person.id) ?? []);
  const nobodyMarked = roster != null && joined.length > 0 && joined.every((person) => !presentIds.has(person.id));
  const noPeople = workplace != null && people.length === 0;
  const added = addedId ? people.find((person) => person.id === addedId) : undefined;

  const dock = noPeople ? (
    <Button
      label="Add your first person"
      icon="plus"
      onPress={() => router.push({ pathname: "/organisation/[id]/add", params: { id: organisationId } })}
    />
  ) : (
    <Button
      label={nobodyMarked ? "Mark today's attendance" : "Mark attendance"}
      icon="tick"
      disabled={workplace == null || joined.length === 0}
      onPress={() => router.push({ pathname: "/organisation/[id]/attendance", params: { id: organisationId } })}
    />
  );

  return (
    <Page
      back={{ label: "Choose", fallback: { pathname: "/organisation/[id]/choose", params: { id: organisationId } } }}
      right={justCreated ? <Stamp label="Created" tick /> : <Stamp label={formatDay(today)} />}
      dock={dock}
      overlay={
        added ? (
          <Toast
            message={`${added.name} added`}
            actionLabel="Open"
            bottom={toastBottom}
            duration={4000}
            onAction={() => {
              setAddedId(null);
              router.push({ pathname: "/organisation/[id]/employee/[employeeId]", params: { id: organisationId, employeeId: added.id } });
            }}
            onDone={() => setAddedId(null)}
          />
        ) : null
      }
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}>
      {workplace ? <OrgCard name={workplace.name} subtitle="Employee portal" organisationId={organisationId} section="employees" /> : <Skeleton width="100%" height={88} />}
      {workplace ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/organisation/[id]/profile", params: { id: organisationId } })}
          className="self-start">
          <AppText variant="bold" style={{ textDecorationLine: "underline" }}>
            Workplace details
          </AppText>
        </Pressable>
      ) : null}

      {failed ? (
        <LoadError
          title="Couldn't open this page."
          message="Your marks and money are safe. Check the internet, then try again."
          onRetry={load}
        />
      ) : workplace == null ? (
        <Loading />
      ) : noPeople ? (
        <View className="pt-10">
          <Empty art={<PeopleArt />} title="No people yet">
            Add the people who work here. Then each morning you can mark who came, and see what you owe them.
          </Empty>
        </View>
      ) : (
        <>
          <Money people={people} />

          <View>
            <SectionHead
              title="Today"
              right={
                <AppText size="sm" tone="ink3">
                  {`${joined.length} working`}
                </AppText>
              }
            />
            {rosterFailed ? (
              <LoadError title="Couldn't load today's marks." message="Check the internet." onRetry={load} />
            ) : roster == null ? (
              <Skeleton width="100%" height={112} />
            ) : nobodyMarked ? (
              <Banner tone="calm">
                <AppText variant="display" size="h2">
                  {"Nobody marked yet\n"}
                </AppText>
                <AppText tone="ink2">
                  Tap Mark attendance when the team has come in. Until then, today counts as Not here for everyone.
                </AppText>
              </Banner>
            ) : (
              <TodaySplit
                present={joined.filter((person) => presentIds.has(person.id))}
                away={joined.filter((person) => !presentIds.has(person.id))}
              />
            )}
            {people
              .filter((person) => person.joinedOn > today)
              .map((person) => (
                <View key={person.id} className="mt-3 flex-row items-center">
                  <Mark kind="waiting" />
                  <AppText tone="ink2" className="ml-2.5 flex-1">
                    {`${firstName(person.name)} joins on ${formatDay(person.joinedOn)}. Not counted yet.`}
                  </AppText>
                </View>
              ))}
          </View>

          <View>
            <SectionHead
              title="People"
              right={
                <Button
                  label="Add person"
                  variant="line"
                  small
                  icon="plus"
                  onPress={() => router.push({ pathname: "/organisation/[id]/add", params: { id: organisationId } })}
                />
              }
            />
            <View className="border-t border-rule">
              {people.map((person) => {
                const waiting = person.joinedOn > today;
                return (
                  <Row
                    key={person.id}
                    left={<Mark kind={waiting ? "waiting" : presentIds.has(person.id) ? "present" : "away"} />}
                    title={person.name}
                    subtitle={person.id === addedId ? `${person.role} · new` : person.role}
                    highlight={person.id === addedId}
                    right={<Owed payable={Math.round(person.payable)} joinsOn={waiting ? formatShortDate(person.joinedOn) : null} />}
                    accessibilityLabel={describe(person, waiting, presentIds.has(person.id))}
                    onPress={() =>
                      router.push({
                        pathname: "/organisation/[id]/employee/[employeeId]",
                        params: { id: organisationId, employeeId: person.id },
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
        </>
      )}
    </Page>
  );
}

/** Order never changes: the order people were added, joins-later last. */
function orderPeople(employees: Employee[], today: string): Employee[] {
  return [...employees].sort((a, b) => {
    const wa = a.joinedOn > today ? 1 : 0;
    const wb = b.joinedOn > today ? 1 : 0;
    if (wa !== wb) return wa - wb;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

function describe(person: Employee, waiting: boolean, present: boolean): string {
  const today = waiting ? `joins ${formatShortDate(person.joinedOn)}` : present ? "present today" : "not here today";
  const pay = Math.round(person.payable);
  const money = pay < 0 ? `given ahead ${formatRupees(-pay)}` : `${formatRupees(pay)} to pay`;
  return `${person.name}, ${person.role}, ${today}, ${waiting ? "nothing yet" : money}`;
}

function Money({ people }: { people: Employee[] }) {
  const earned = people.reduce((sum, person) => sum + Math.round(person.earned), 0);
  const given = people.reduce((sum, person) => sum + Math.round(person.given), 0);
  const owed = people.reduce((sum, person) => sum + Math.max(Math.round(person.payable), 0), 0);
  const ahead = people.filter((person) => Math.round(person.payable) < 0);
  const aheadTotal = ahead.reduce((sum, person) => sum - Math.round(person.payable), 0);

  return (
    <View className="gap-2">
      <Total label={`Still to pay for ${monthName(todayIso())}`} amount={owed} />
      <View className="mt-2 gap-1">
        <Leader label="Earned so far" value={formatRupees(earned)} />
        <Leader label="Money given" value={formatRupees(given)} />
      </View>
      {ahead.length > 0 ? (
        <AppText size="sm" tone="ink3">
          {ahead.length === 1
            ? `${firstName(ahead[0].name)} was given ${formatRupees(aheadTotal)} ahead. That is not taken off this total.`
            : `${ahead.length} people were given ${formatRupees(aheadTotal)} ahead in all. That is not taken off this total.`}
        </AppText>
      ) : null}
    </View>
  );
}

function TodaySplit({ present, away }: { present: Employee[]; away: Employee[] }) {
  return (
    <View className="flex-row overflow-hidden rounded-md border-2 border-ink bg-sheet">
      <SplitHalf kind="present" label="Present" people={present} />
      <View className="w-[2px] bg-ink" />
      <SplitHalf kind="away" label="Not here" people={away} />
    </View>
  );
}

function SplitHalf({ kind, label, people }: { kind: "present" | "away"; label: string; people: Employee[] }) {
  return (
    <View
      accessible
      accessibilityLabel={`${people.length} ${label}${people.length ? `: ${people.map((p) => firstName(p.name)).join(", ")}` : ""}`}
      className="flex-1 gap-1 px-4 py-3.5">
      <View className="flex-row items-center">
        <Mark kind={kind} />
        <AppText variant="display" size="count" className="ml-2.5">
          {people.length}
        </AppText>
      </View>
      <AppText variant="bold">{label}</AppText>
      {people.length > 0 ? (
        <AppText variant="medium" tone="ink2" numberOfLines={3}>
          {people.map((person) => firstName(person.name)).join(", ")}
        </AppText>
      ) : null}
    </View>
  );
}

function Loading() {
  return (
    <>
      <View className="gap-3">
        <AppText variant="bold" size="lg" tone="ink2">
          {`Still to pay for ${monthName(todayIso())}`}
        </AppText>
        <Skeleton width={230} height={62} />
        <Skeleton width="100%" height={18} />
        <Skeleton width="100%" height={18} />
      </View>
      <View className="gap-3">
        <SectionHead title="Today" />
        <Skeleton width="100%" height={112} />
      </View>
    </>
  );
}
