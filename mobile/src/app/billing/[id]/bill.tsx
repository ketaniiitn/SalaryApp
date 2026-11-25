import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, LoadError, Skeleton } from "@/components/book";
import { Button } from "@/components/button";
import { Page } from "@/components/page";
import { useScreenPad } from "@/components/screen";
import { TextLink } from "@/components/text-link";
import { createCustomer, createInvoice, createItem, getBusiness, getInvoice, listCustomers, listItems, updateCustomer } from "@/billing/api";
import { CustomerStep, DetailsStep, ItemsStep, QUESTIONS, ReviewStep, StepTabs } from "@/billing/compose";
import {
  billFor,
  buyerChanged,
  buyerFromCustomer,
  buyerProblems,
  clearDraft,
  customerInput,
  detailProblems,
  documentFor,
  draftFromInvoice,
  draftHasWork,
  invoiceInput,
  itemProblems,
  lineFromItem,
  lineKey,
  loadDraft,
  newDraft,
  previewLines,
  saveDraft,
  type BillDraft,
  type ItemForm,
  type LineDraft,
  type Step,
} from "@/billing/draft";
import { formatMoney, type Business, type Customer, type Item } from "@/billing/engine";
import { InvoicePreview } from "@/billing/preview";
import { ApiError, isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

const WIDE = 900;

export default function BillScreen() {
  const params = useLocalSearchParams<{ id: string; from?: string; customer?: string }>();
  const businessId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fromInvoice = typeof params.from === "string" ? params.from : undefined;
  const forCustomer = typeof params.customer === "string" ? params.customer : undefined;
  const { url, ready } = useServerUrl();
  const { width } = useWindowDimensions();
  const pad = useScreenPad();
  const wide = width >= WIDE;

  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<Record<Step, boolean>>({ 1: false, 2: false, 3: false, 4: false });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [confirmReset, setConfirmReset] = useState(false);
  const opened = useRef(false);
  const scroller = useRef<ScrollViewInstance>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [nextBusiness, nextItems, nextCustomers] = await Promise.all([getBusiness(url, businessId), listItems(url, businessId), listCustomers(url, businessId)]);
      setBusiness(nextBusiness);
      setItems(nextItems);
      setCustomers(nextCustomers);
      if (!opened.current) {
        opened.current = true;
        if (fromInvoice) {
          setDraft(draftFromInvoice(nextBusiness, await getInvoice(url, businessId, fromInvoice)));
        } else if (forCustomer) {
          const customer = nextCustomers.find((entry) => entry.id === forCustomer);
          setDraft({ ...newDraft(nextBusiness), buyer: customer ? buyerFromCustomer(customer) : newDraft(nextBusiness).buyer, step: customer ? 2 : 1 });
        } else {
          const kept = await loadDraft(businessId);
          if (draftHasWork(kept)) {
            setDraft(kept);
            setRestored(kept.updatedAt);
          } else {
            setDraft(newDraft(nextBusiness));
          }
        }
      }
      setLoadProblem(null);
    } catch (caught) {
      setLoadProblem(isOffline(caught) ? "The phone could not reach the server." : caught instanceof Error ? caught.message : "The bill could not be opened.");
    }
  }, [businessId, forCustomer, fromInvoice, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  useEffect(() => {
    if (!draft || !businessId) return;
    const timer = setTimeout(() => saveDraft(businessId, draft), 300);
    return () => clearTimeout(timer);
  }, [businessId, draft]);

  const update = useCallback((patch: Partial<BillDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current)), []);

  // Jumping ahead several steps runs one step per render, so each step sees the latest draft.
  // It only runs once the bill has loaded (business and draft set), so `advance` below is ready.
  const [jumpTo, setJumpTo] = useState<Step | null>(null);
  const jumpStep = business && draft ? draft.step : null;
  useEffect(() => {
    if (jumpTo == null || jumpStep == null || jumpStep >= jumpTo) return;
    advance().then((ok) => {
      // Stop at the first problem, or once the next step is the one asked for.
      if (!ok || jumpStep + 1 >= jumpTo) setJumpTo((current) => (current === jumpTo ? null : current));
    });
    // `advance` is read fresh on purpose: this runs once per step, after the step has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo, jumpStep]);

  if (!business || !draft) {
    return (
      <Page back={{ label: "Billing", fallback: { pathname: "/billing/[id]", params: { id: businessId } } }}>
        {loadProblem ? <LoadError title="Couldn't open the bill." message={loadProblem} onRetry={load} /> : <Skeleton width="100%" height={320} />}
      </Page>
    );
  }

  const gst = business.gstRegistered;
  const bill = billFor(business, draft);
  const shownBill = billFor(business, draft, previewLines(draft, gst));
  const doc = documentFor(business, draft, shownBill);
  const step = draft.step;

  function goStep(next: Step) {
    setError(null);
    update({ step: next });
    scroller.current?.scrollTo({ y: 0, animated: false });
  }

  /** Close the item editor on the way out: add it if it is complete, drop it if it is empty. */
  function settleItem(form: ItemForm | null): { ok: boolean; patch: Partial<BillDraft> } {
    if (!form || !business) return { ok: true, patch: {} };
    const line = lineFromItem(form, gst);
    if (line) {
      const saved = { ...line, key: form.key ?? lineKey() };
      const lines = form.key ? draft!.lines.map((existing) => (existing.key === form.key ? saved : existing)) : [...draft!.lines, saved];
      if (form.saveForLater && !form.itemId) saveForLater(saved);
      return { ok: true, patch: { lines, item: null } };
    }
    const untouched = !form.key && !form.name.trim() && !form.quantity.trim() && !form.price.trim();
    if (untouched) return { ok: true, patch: { item: null } };
    return { ok: false, patch: {} };
  }

  async function saveCustomer(): Promise<boolean> {
    if (!draft || !businessId) return false;
    const problems = buyerProblems(draft.buyer);
    if (Object.keys(problems).length > 0) {
      setAttempted((current) => ({ ...current, 1: true }));
      setError(draft.buyer.name.trim() ? "Check the customer details." : "Choose a customer, or add a new one.");
      return false;
    }
    const saved = draft.buyer.id ? customers.find((customer) => customer.id === draft.buyer.id) : undefined;
    if (draft.buyer.id && !buyerChanged(draft.buyer, saved)) return true;
    setBusy(true);
    try {
      const input = customerInput(draft.buyer);
      const customer = draft.buyer.id ? await updateCustomer(url, businessId, draft.buyer.id, input) : await createCustomer(url, businessId, input);
      update({ buyer: { ...buyerFromCustomer(customer), state: customer.state || business!.state } });
      setCustomers((current) => [...current.filter((entry) => entry.id !== customer.id), customer].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The customer was not saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** "Save to my items": the line stays on the bill even if saving the item fails. */
  async function saveForLater(line: LineDraft) {
    if (!businessId) return;
    try {
      const item = await createItem(url, businessId, {
        name: line.name,
        description: line.description,
        price: line.unitPrice,
        hsn: line.hsn,
        gstRate: line.gstRate,
        priceMode: line.priceMode,
        unit: line.unit,
        supply: line.supply,
      });
      setItems((current) => [item, ...current]);
      setDraft((current) => (current ? { ...current, lines: current.lines.map((entry) => (entry.key === line.key ? { ...entry, itemId: item.id } : entry)) } : current));
    } catch {
      setError(`${line.name} is on the bill, but it was not saved to your items.`);
    }
  }

  /** Move one step forward if this step is complete. */
  async function advance(): Promise<boolean> {
    if (!draft || !business) return false;
    setError(null);
    if (draft.step === 1) {
      if (!(await saveCustomer())) return false;
      goStep(2);
      return true;
    }
    if (draft.step === 2) {
      const settled = settleItem(draft.item);
      if (!settled.ok) {
        setAttempted((current) => ({ ...current, 2: true }));
        setError(Object.values(itemProblems(draft.item!, gst))[0] ?? "Finish this item, or cancel it.");
        return false;
      }
      const lines = settled.patch.lines ?? draft.lines;
      if (lines.length === 0) {
        setAttempted((current) => ({ ...current, 2: true }));
        setError("Add at least one item.");
        return false;
      }
      update({ ...settled.patch, step: 3 });
      scroller.current?.scrollTo({ y: 0, animated: false });
      return true;
    }
    if (draft.step === 3) {
      const problem = detailProblems(draft, bill);
      if (problem) {
        setError(problem);
        return false;
      }
      goStep(4);
      return true;
    }
    return false;
  }

  async function jump(target: Step) {
    if (!draft) return;
    if (target <= draft.step) {
      setJumpTo(null);
      if (draft.step === 2 && draft.item) {
        const settled = settleItem(draft.item);
        if (settled.ok) update(settled.patch);
      }
      goStep(target);
      return;
    }
    // Forward through Continue, one step at a time, stopping at the first problem.
    // Each step runs in its own render (see the effect below): a loop here would reuse this
    // render's `draft`, re-running the same step, so customers and items were saved twice.
    setJumpTo(target);
  }


  async function generate() {
    if (!draft || !business || !businessId) return;
    setError(null);
    if (!draft.buyer.id) {
      goStep(1);
      setError("Save the customer first.");
      return;
    }
    if (draft.lines.length === 0) {
      goStep(2);
      setError("Add at least one item.");
      return;
    }
    const problem = detailProblems(draft, bill);
    if (problem) {
      goStep(3);
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const invoice = await createInvoice(url, businessId, invoiceInput(business, draft, draft.buyer.id, bill));
      await clearDraft(businessId);
      router.replace({ pathname: "/billing/[id]/invoice/[invoiceId]", params: { id: businessId, invoiceId: invoice.id, created: "1" } });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setBusiness(await getBusiness(url, businessId).catch(() => business));
      }
      setError(isOffline(caught) ? "The phone could not reach the server. Your bill is kept here; try again." : caught instanceof Error ? caught.message : "The invoice was not generated.");
      setBusy(false);
    }
  }

  async function startOver() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    if (!businessId || !business) return;
    await clearDraft(businessId);
    setDraft(newDraft(business));
    setRestored(null);
    setConfirmReset(false);
    setAttempted({ 1: false, 2: false, 3: false, 4: false });
    setError(null);
  }

  const form = (
    <View className="gap-5">
      <StepTabs step={step} onStep={jump} />
      <View className="flex-row items-end justify-between">
        <AppText variant="display" size="title" accessibilityRole="header" className="mr-3 flex-1">
          {QUESTIONS[step]}
        </AppText>
      </View>
      {restored ? (
        <Banner tone="info" actions={<TextLink label={confirmReset ? "Tap again to clear it" : "Start over"} onPress={startOver} />}>
          {`Your unsaved bill was kept${draft.buyer.name.trim() ? ` for ${draft.buyer.name.trim()}` : ""}.`}
        </Banner>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {step === 1 ? (
        <CustomerStep
          key={`${draft.ref}-${draft.buyer.id ?? "new"}`}
          business={business}
          customers={customers}
          buyer={draft.buyer}
          problems={attempted[1] ? buyerProblems(draft.buyer) : {}}
          onChange={(buyer) => update({ buyer })}
        />
      ) : null}
      {step === 2 ? <ItemsStep business={business} items={items} draft={draft} bill={bill} attempted={attempted[2]} onDraft={update} onSaveForLater={saveForLater} /> : null}
      {step === 3 ? <DetailsStep business={business} draft={draft} bill={bill} onDraft={update} /> : null}
      {step === 4 ? (
        <ReviewStep
          business={business}
          draft={draft}
          bill={bill}
          onEdit={goStep}
          onEditSeller={() => router.push({ pathname: "/billing/[id]/settings", params: { id: businessId } })}
        />
      ) : null}
      {!restored && step === 1 && draftHasWork(draft) ? (
        <View className="items-start">
          <TextLink label={confirmReset ? "Tap again to clear this bill" : "Start over"} tone="cloth" onPress={startOver} />
        </View>
      ) : null}
    </View>
  );

  const dock = (
    <View className="flex-row items-center gap-3">
      <View className="min-w-[96px] flex-1">
        <AppText size="xs" tone="ink3" numberOfLines={1}>
          {gst ? `GST ${formatMoney(shownBill.tax)}` : `${shownBill.lines.length} ${shownBill.lines.length === 1 ? "item" : "items"}`}
        </AppText>
        <AppText variant="figure" size="xl" numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(shownBill.payable)}
        </AppText>
      </View>
      <View className="flex-[1.6]">
        {step < 4 ? (
          <Button label="Continue" loading={busy} onPress={advance} />
        ) : (
          <Button label={busy ? "Generating…" : "Generate invoice"} icon="tick" loading={busy} onPress={generate} />
        )}
      </View>
    </View>
  );

  const previewNote = `${doc.number} is confirmed when you generate.`;

  return (
    <Page
      keyboard
      scroll={false}
      back={{
        label: step === 1 ? business.name : "Back",
        fallback: { pathname: "/billing/[id]", params: { id: businessId } },
        onPress: step === 1 ? undefined : () => jump((step - 1) as Step),
      }}
      right={
        wide ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === "edit" ? "Show the invoice preview" : "Back to editing"}
            onPress={() => setView((current) => (current === "edit" ? "preview" : "edit"))}
            className={`rounded-md border-2 px-3 py-1.5 ${view === "preview" ? "border-ink bg-ink" : "border-ink bg-paper active:bg-sheet"}`}>
            <AppText variant="semibold" size="sm" tone={view === "preview" ? "sheet" : "ink"}>
              {view === "edit" ? "Preview" : "Edit"}
            </AppText>
          </Pressable>
        )
      }
      dock={dock}>
      {wide ? (
        <View className="flex-1 flex-row">
          <ScrollView ref={scroller} style={{ width: Math.min(560, width * 0.46), flexGrow: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 28, paddingTop: 8, paddingBottom: 40 }}>
            {form}
          </ScrollView>
          <View className="flex-1 border-l border-rule bg-sheet px-6 pb-4 pt-2">
            <InvoicePreview doc={doc} note={previewNote} />
          </View>
        </View>
      ) : view === "preview" ? (
        <View className="flex-1 pb-3 pt-1" style={{ paddingHorizontal: pad }}>
          <InvoicePreview doc={doc} note={previewNote} />
        </View>
      ) : (
        <ScrollView ref={scroller} className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 32 }}>
          {form}
        </ScrollView>
      )}
    </Page>
  );
}
