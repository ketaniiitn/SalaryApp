import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, Empty, LoadError, Pill, Skeleton, Stamp, Toast } from "@/components/book";
import { Button } from "@/components/button";
import { ChevronLeft, ChevronRight, PeopleArt } from "@/components/icons";
import { Page, useToastOffset } from "@/components/page";
import { getAttendance, getOrganisation, saveAttendance } from "@/lib/api";
import { firstName, formatDay, formatShortDate, monthName, shiftIso, todayIso, weekdayName } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";
import { colors } from "@/lib/theme";
import type { AttendanceEmployee } from "@/lib/types";

export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const organisationId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const toastBottom = useToastOffset();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [workplaceName, setWorkplaceName] = useState("Workplace");
  const [rows, setRows] = useState<AttendanceEmployee[] | null>(null);
  // The day `rows` belongs to. Marks are only saved when it matches the day on screen.
  const [rowsFor, setRowsFor] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [undo, setUndo] = useState<AttendanceEmployee[] | null>(null);
  const seq = useRef(0);
  const loadSeq = useRef(0);

  useEffect(() => {
    if (!ready || !organisationId) return;
    getOrganisation(url, organisationId)
      .then((workplace) => setWorkplaceName(workplace.name))
      .catch(() => undefined);
  }, [organisationId, ready, url]);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const forDate = date;
    const mine = ++loadSeq.current;
    setLoadingDay(true);
    try {
      const day = await getAttendance(url, organisationId, forDate);
      // A newer load (another day, or the same day again) has started: this answer is stale.
      if (mine !== loadSeq.current) return;
      setRows(day.employees);
      setRowsFor(forDate);
      setLoadFailed(false);
      setUnsaved(new Set());
      setSaveFailed(false);
    } catch {
      if (mine !== loadSeq.current) return;
      setLoadFailed(true);
    } finally {
      if (mine === loadSeq.current) setLoadingDay(false);
    }
  }, [date, organisationId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  /** Marks change on screen at once; the save runs behind. Only the latest save's answer counts. */
  async function persist(next: AttendanceEmployee[], changed: string[]) {
    if (!organisationId || busy) return;
    const forDate = date;
    setRows(next);
    setUnsaved((current) => new Set([...current, ...changed]));
    const mine = ++seq.current;
    try {
      await saveAttendance(
        url,
        organisationId,
        forDate,
        next.filter((person) => person.present && forDate >= person.joinedOn).map((person) => person.id),
      );
      if (mine !== seq.current) return;
      setUnsaved(new Set());
      setSaveFailed(false);
      setSaved(true);
    } catch {
      if (mine !== seq.current) return;
      setSaveFailed(true);
    }
  }

  function toggle(person: AttendanceEmployee) {
    if (!rows || busy || date < person.joinedOn) return;
    setUndo(null);
    persist(
      rows.map((item) => (item.id === person.id ? { ...item, present: !item.present } : item)),
      [person.id],
    );
  }

  function setAll(present: boolean) {
    if (!rows || busy) return;
    const markable = rows.filter((person) => date >= person.joinedOn);
    const next = rows.map((person) => ({ ...person, present: present && date >= person.joinedOn }));
    setUndo(present ? null : rows);
    persist(
      next,
      markable.map((person) => person.id),
    );
  }

  function goTo(next: string) {
    seq.current++;
    setUndo(null);
    setSaved(false);
    setDate(next);
  }

  // Until the day on screen has loaded, the rows are from another day: nothing can be marked.
  const busy = loadingDay || rowsFor !== date;
  const markable = rows?.filter((person) => date >= person.joinedOn) ?? [];
  const waiting = rows?.filter((person) => date < person.joinedOn) ?? [];
  const presentCount = markable.filter((person) => person.present).length;
  const olderMonth = date.slice(0, 7) !== today.slice(0, 7);
  const failedNames = (rows ?? []).filter((person) => unsaved.has(person.id)).map((person) => firstName(person.name));
  const dayTop = date === today ? "Today" : date === shiftIso(today, -1) ? "Yesterday" : weekdayName(date);

  return (
    <Page
      back={{ label: workplaceName, fallback: { pathname: "/organisation/[id]", params: { id: organisationId } } }}
      right={saved ? <Stamp label="Saved" tick /> : null}
      dock={<Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: "/organisation/[id]", params: { id: organisationId } }))} />}
      overlay={
        undo ? (
          <Toast
            message="Day cleared"
            actionLabel="Undo"
            bottom={toastBottom}
            onAction={() => {
              const previous = undo;
              setUndo(null);
              persist(previous, previous.map((person) => person.id));
            }}
            onDone={() => setUndo(null)}
          />
        ) : null
      }>
      <View className="flex-row items-center gap-2">
        <DayArrow label="Earlier day" onPress={() => goTo(shiftIso(date, -1))}>
          <ChevronLeft size={24} />
        </DayArrow>
        <View className="flex-1 items-center" accessible accessibilityLiveRegion="polite" accessibilityLabel={`${dayTop}, ${formatDay(date)}`}>
          <AppText variant="bold" size="xs" tone="ink3" style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
            {dayTop}
          </AppText>
          <AppText variant="display" size="h3">
            {formatDay(date)}
          </AppText>
        </View>
        <DayArrow label="Next day" disabled={date >= today} onPress={() => goTo(shiftIso(date, 1))}>
          <ChevronRight size={24} color={date >= today ? colors.faint : colors.ink} />
        </DayArrow>
      </View>

      {olderMonth ? (
        <Banner tone="info">
          {`This is ${monthName(date)}. Changes here are kept in the book but don't change ${monthName(today)}'s pay.`}
        </Banner>
      ) : null}

      {loadFailed && (rows == null || rowsFor !== date) ? (
        <LoadError title="Couldn't open this day." message="Check the internet, then try again." onRetry={load} />
      ) : rows == null ? (
        <View className="gap-3">
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={78} />
          <Skeleton width="100%" height={78} />
        </View>
      ) : rows.length === 0 ? (
        <View className="pt-6">
          <Empty art={<PeopleArt />} title="No people yet">
            Add the people who work here before marking attendance.
          </Empty>
          <Button
            label="Add person"
            variant="line"
            icon="plus"
            onPress={() => router.replace({ pathname: "/organisation/[id]/add", params: { id: organisationId } })}
          />
        </View>
      ) : (
        <>
          <View className="flex-row overflow-hidden rounded-md border-2 border-ink bg-sheet">
            <CountHalf count={presentCount} label="Present" />
            <View className="w-[2px] bg-ink" />
            <CountHalf count={markable.length - presentCount} label="Not here" />
          </View>

          {saveFailed ? (
            <Banner
              title={
                failedNames.length === 1
                  ? `${failedNames[0]}'s mark didn't save.`
                  : failedNames.length > 1
                    ? "Some marks didn't save."
                    : "That change didn't save."
              }
              actions={<Button label="Try again" variant="line" small className="flex-1" disabled={busy} onPress={() => rows && persist(rows, [])} />}>
              No internet right now.
            </Banner>
          ) : null}

          {markable.length > 0 ? (
            <View className="flex-row gap-2.5">
              <Button label="Everyone present" variant="line" small className="flex-1" disabled={busy} onPress={() => setAll(true)} />
              <Button label="Clear the day" variant="line" small className="flex-1" disabled={busy || presentCount === 0} onPress={() => setAll(false)} />
            </View>
          ) : null}

          <View className="border-t border-rule" style={{ opacity: busy ? 0.5 : 1 }}>
            {markable.map((person) => {
              const notSaved = saveFailed && unsaved.has(person.id);
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: person.present, disabled: busy }}
                  accessibilityLabel={`${person.name}, ${person.role}`}
                  accessibilityHint="Double tap to switch Present and Not here"
                  disabled={busy}
                  onPress={() => toggle(person)}
                  className="min-h-[78px] flex-row items-center border-b border-rule py-2.5 active:opacity-70">
                  <View className="flex-1 pr-3">
                    <AppText variant="bold" size="xl">
                      {person.name}
                    </AppText>
                    <AppText tone={notSaved ? "cloth" : "ink3"} variant={notSaved ? "semibold" : "body"}>
                      {notSaved ? "Not saved yet" : person.role}
                    </AppText>
                  </View>
                  <Pill kind={person.present ? "present" : "away"} label={person.present ? "Present" : "Not here"} faded={notSaved} />
                </Pressable>
              );
            })}
            {waiting.map((person) => (
              <View
                key={person.id}
                accessible
                accessibilityLabel={`${person.name}, joins ${formatShortDate(person.joinedOn)}`}
                className="min-h-[78px] flex-row items-center border-b border-rule py-2.5">
                <View className="flex-1 pr-3">
                  <AppText variant="bold" size="xl" tone="ink2">
                    {person.name}
                  </AppText>
                  <AppText tone="ink3">{person.role}</AppText>
                </View>
                <Pill kind="waiting" label={`Joins ${formatShortDate(person.joinedOn)}`} />
              </View>
            ))}
          </View>

          {date !== today ? <Button label="Back to today" variant="text" onPress={() => goTo(today)} /> : null}
        </>
      )}
    </Page>
  );
}

function DayArrow({ label, disabled = false, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-12 w-12 items-center justify-center rounded-md border-2 active:opacity-70 ${disabled ? "border-rule" : "border-ink"}`}>
      {children}
    </Pressable>
  );
}

function CountHalf({ count, label }: { count: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${count} ${label}`} className="flex-1 flex-row items-center px-4 py-3">
      <AppText variant="display" style={{ fontSize: 32, lineHeight: 44 }}>
        {count}
      </AppText>
      <AppText variant="bold" className="ml-2.5">
        {label}
      </AppText>
    </View>
  );
}
