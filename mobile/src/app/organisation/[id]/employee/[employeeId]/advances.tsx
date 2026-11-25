import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { AheadStamp, Banner, Empty, Leader, LoadError, Skeleton, Stamp, Toast, Total } from "@/components/book";
import { Button } from "@/components/button";
import { BottomSheet } from "@/components/date-sheet";
import { Field, Hint } from "@/components/field";
import { CalendarIcon, CashArt } from "@/components/icons";
import { MonthGrid } from "@/components/month-calendar";
import { Page, useToastOffset } from "@/components/page";
import { readRupees } from "@/components/pay-fields";
import { ApiError, addAdvance, getAdvances, getOrganisation, removeAdvance } from "@/lib/api";
import { firstName, formatLongDay, formatRupees, formatShortDate, monthName, shiftIso, todayIso } from "@/lib/pay";
import { useServerUrl } from "@/lib/server-url";
import { colors } from "@/lib/theme";
import type { Advance, AdvanceLedger } from "@/lib/types";

export default function MoneyGivenScreen() {
  const params = useLocalSearchParams<{ id: string; employeeId: string }>();
  const organisationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const personId = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
  const { url, ready } = useServerUrl();
  const toastBottom = useToastOffset();
  const today = todayIso();
  const [name, setName] = useState("Person");
  const [joinedOn, setJoinedOn] = useState(`${today.slice(0, 7)}-01`);
  const [ledger, setLedger] = useState<AdvanceLedger | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState<Advance | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId || !personId) return;
    try {
      const [workplace, next] = await Promise.all([getOrganisation(url, organisationId), getAdvances(url, organisationId, personId)]);
      const person = workplace.employees.find((item) => item.id === personId);
      if (person) {
        setName(person.name);
        setJoinedOn(person.joinedOn);
      }
      setLedger(next);
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

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function remove(advance: Advance) {
    if (!organisationId || !personId || busy) return;
    setBusy(advance.id);
    setRowError(null);
    try {
      setLedger(await removeAdvance(url, organisationId, personId, advance.id));
      setRemoved(advance);
      setSaved(true);
    } catch {
      setRowError("Couldn't remove it. Check the internet and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function undoRemove() {
    const advance = removed;
    setRemoved(null);
    if (!advance || !organisationId || !personId) return;
    try {
      setLedger(await addAdvance(url, organisationId, personId, { amount: advance.amount, givenOn: advance.givenOn }));
      setSaved(true);
    } catch {
      setRowError("Couldn't put it back. Add it again with Add money given.");
    }
  }

  const advances = [...(ledger?.advances ?? [])].sort((a, b) =>
    a.givenOn === b.givenOn ? (a.createdAt < b.createdAt ? 1 : -1) : a.givenOn < b.givenOn ? 1 : -1,
  );
  const month = monthName(today);
  const first = firstName(name);

  return (
    <Page
      back={{
        label: name,
        fallback: { pathname: "/organisation/[id]/employee/[employeeId]", params: { id: organisationId, employeeId: personId } },
      }}
      right={saved ? <Stamp label="Saved" tick /> : null}
      dock={<Button label="Add money given" icon="plus" disabled={!ledger} onPress={() => setAdding(true)} />}
      overlay={
        <>
          {removed ? (
            <Toast
              message={`Removed ${formatRupees(removed.amount)} from ${formatShortDate(removed.givenOn)}`}
              actionLabel="Undo"
              bottom={toastBottom}
              onAction={undoRemove}
              onDone={() => setRemoved(null)}
            />
          ) : null}
          <AddSheet
            visible={adding}
            first={first}
            joinedOn={joinedOn}
            onClose={() => setAdding(false)}
            onSave={async (amount, givenOn) => {
              if (!organisationId || !personId) return;
              setLedger(await addAdvance(url, organisationId, personId, { amount, givenOn }));
              setAdding(false);
              setSaved(true);
            }}
          />
        </>
      }>
      <View>
        <AppText variant="display" size="title" accessibilityRole="header">
          Money given
        </AppText>
        <AppText tone="ink2">{`Cash handed to ${first} in ${month}.`}</AppText>
      </View>

      {failed && !ledger ? (
        <LoadError title="Couldn't open this page." message="Check the internet, then try again." onRetry={load} />
      ) : !ledger ? (
        <View className="gap-3">
          <Skeleton width={160} height={48} />
          <Skeleton width="100%" height={18} />
          <Skeleton width="100%" height={76} className="mt-3" />
        </View>
      ) : advances.length === 0 ? (
        <View className="pt-8">
          <Empty art={<CashArt />} title="No money given this month">
            {`When you hand ${first} some cash, add it here. Still to pay will go down by that much.`}
          </Empty>
        </View>
      ) : (
        <>
          <View className="gap-2">
            <Total label={`Given in ${month}`} amount={ledger.given} size="md" />
            <View className="mt-2">
              {ledger.payable < 0 ? (
                <View className="flex-row items-center justify-between">
                  <AppText variant="medium" size="lg" tone="ink2">
                    After this
                  </AppText>
                  <AheadStamp amount={-ledger.payable} />
                </View>
              ) : (
                <Leader label="Still to pay after this" value={formatRupees(ledger.payable)} />
              )}
            </View>
          </View>
          {rowError ? <Banner>{rowError}</Banner> : null}
          <View className="border-t border-rule">
            {advances.map((advance) => (
              <View key={advance.id} className="min-h-[76px] flex-row items-center border-b border-rule py-2.5" style={{ opacity: busy === advance.id ? 0.5 : 1 }}>
                <View className="flex-1" accessible accessibilityLabel={`${formatRupees(advance.amount)} on ${formatLongDay(advance.givenOn)}`}>
                  <AppText variant="display" size="h3">
                    {formatRupees(advance.amount)}
                  </AppText>
                  <AppText tone="ink3">{formatLongDay(advance.givenOn)}</AppText>
                </View>
                <Button
                  label="Remove"
                  variant="text"
                  small
                  accessibilityLabel={`Remove ${formatRupees(advance.amount)} given on ${formatShortDate(advance.givenOn)}`}
                  disabled={busy != null}
                  onPress={() => remove(advance)}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

function AddSheet({
  visible,
  first,
  joinedOn,
  onClose,
  onSave,
}: {
  visible: boolean;
  first: string;
  joinedOn: string;
  onClose: () => void;
  onSave: (amount: number, givenOn: string) => Promise<void>;
}) {
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  const earliest = joinedOn > monthStart ? joinedOn : monthStart;
  const [amountText, setAmountText] = useState("");
  const [day, setDay] = useState(today);
  const [otherDay, setOtherDay] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmountText("");
    setDay(today);
    setOtherDay(false);
    setAmountError(null);
    setSaveError(null);
    setSaving(false);
  }, [visible, today]);

  const quick = [0, -1, -2]
    .map((offset) => shiftIso(today, offset))
    .filter((iso) => iso >= earliest)
    .map((iso, i) => ({ iso, top: i === 0 ? "Today" : i === 1 ? "Yesterday" : formatLongDay(iso).slice(0, 3) }));
  const amount = readRupees(amountText);
  const dayWords = day === today ? "today" : `on ${formatShortDate(day)}`;

  async function save() {
    if (amount == null) {
      setAmountError("Write how much you gave.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(amount, day);
    } catch (caught) {
      // Show the server reason (for example "That person had not joined by this date."), not just "try again".
      setSaveError(caught instanceof ApiError && caught.kind === "http" ? caught.message : "Check the internet and try again.");
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "position" : undefined}>
        <AppText variant="display" size="h3" className="mb-3">
          {`Money given to ${first}`}
        </AppText>
        {saveError ? (
          <View className="mb-4">
            <Banner title="Couldn't save.">{saveError}</Banner>
          </View>
        ) : null}
        <Field
          label="How much?"
          big
          prefix="₹"
          autoFocus
          keyboardType="number-pad"
          value={amountText}
          onChangeText={(text) => {
            setAmountText(text.replace(/[^\d,]/g, ""));
            setAmountError(null);
          }}
          error={amountError}
        />
        <AppText variant="bold" className="mb-2">
          Which day?
        </AppText>
        <View className="flex-row gap-2">
          {quick.map((option) => (
            <Chip
              key={option.iso}
              top={option.top}
              bottom={formatShortDate(option.iso)}
              on={!otherDay && day === option.iso}
              onPress={() => {
                setOtherDay(false);
                setDay(option.iso);
              }}
            />
          ))}
          <Chip top={<CalendarIcon color={otherDay ? colors.sheet : colors.ink} />} bottom="Other day" on={otherDay} onPress={() => setOtherDay(true)} />
        </View>
        {otherDay ? (
          <View className="mt-3">
            <MonthGrid
              month={today.slice(0, 7)}
              today={today}
              dayState={(iso) => (iso < earliest || iso > today ? "faded" : iso === day ? "selected" : "open")}
              onDayPress={setDay}
              onPrev={() => undefined}
              onNext={() => undefined}
              canPrev={false}
              canNext={false}
            />
          </View>
        ) : null}
        <Hint>{`Only days in ${monthName(today)}, up to today.`}</Hint>
        <Button
          label={saving ? "Saving…" : amount != null ? `Save ${formatRupees(amount)} given ${dayWords}` : "Save money given"}
          loading={saving}
          onPress={save}
          className="mt-4"
        />
        <Button label="Cancel" variant="text" onPress={onClose} />
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

function Chip({ top, bottom, on, onPress }: { top: ReactNode; bottom: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      className={`h-14 flex-1 items-center justify-center rounded-md border-2 px-1 active:opacity-70 ${on ? "border-ink bg-ink" : "border-rule2 bg-paper"}`}>
      {typeof top === "string" ? (
        <AppText variant="bold" tone={on ? "sheet" : "ink"} numberOfLines={1} adjustsFontSizeToFit>
          {top}
        </AppText>
      ) : (
        top
      )}
      <AppText variant="medium" size="xs" tone={on ? "sheet" : "ink3"} numberOfLines={1}>
        {bottom}
      </AppText>
    </Pressable>
  );
}
