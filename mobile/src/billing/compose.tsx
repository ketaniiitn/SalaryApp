import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Leader, SectionHead, Total } from "@/components/book";
import { Button } from "@/components/button";
import { CheckRow } from "@/components/check-row";
import { DateSheet } from "@/components/date-sheet";
import { Disclosure } from "@/components/disclosure";
import { Field, PickerField } from "@/components/field";
import { SearchIcon } from "@/components/icons";
import { SelectSheet } from "@/components/select-sheet";
import { TextLink } from "@/components/text-link";
import { Choices } from "@/billing/choices";
import {
  STEPS,
  emptyBuyer,
  emptyItem,
  itemFromLine,
  itemFromSaved,
  itemProblems,
  lineFromItem,
  lineKey,
  placeOf,
  type BillDraft,
  type BuyerDraft,
  type BuyerProblems,
  type ItemForm,
  type LineDraft,
  type Method,
  type Received,
  type Step,
} from "@/billing/draft";
import {
  GST_RATES,
  INDIAN_STATES,
  UNITS,
  addDays,
  balanceDue,
  calculateLine,
  formatDate,
  formatMoney,
  indiaToday,
  invoiceNumber,
  lineMeasure,
  stateFromGstin,
  GSTIN_PATTERN,
  tradeForCategory,
  unitUsesPacks,
  unitsFor,
  type Business,
  type CalculatedBill,
  type Customer,
  type Item,
} from "@/billing/engine";
import { colors } from "@/lib/theme";

/* ---------------- progress ---------------- */

/** The four steps as an outlined tab bar. Earlier steps are always open; later ones go through Continue. */
export function StepTabs({ step, onStep }: { step: Step; onStep: (step: Step) => void }) {
  return (
    <View accessibilityRole="tablist" className="h-[46px] flex-row overflow-hidden rounded-md border-2 border-ink bg-paper">
      {STEPS.map((entry, index) => {
        const current = entry.step === step;
        const done = entry.step < step;
        return (
          <Pressable
            key={entry.step}
            accessibilityRole="tab"
            accessibilityState={{ selected: current }}
            accessibilityLabel={`Step ${entry.step} of 4, ${entry.label}`}
            onPress={() => onStep(entry.step)}
            className={`flex-1 items-center justify-center px-1 ${current ? "bg-ink" : "active:bg-sheet"}`}
            style={index > 0 ? { borderLeftWidth: 1.5, borderLeftColor: colors.ink } : undefined}>
            <AppText variant="semibold" size="sm" tone={current ? "sheet" : done ? "stamp" : "ink3"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {`${entry.step}. ${entry.label}`}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const QUESTIONS: Record<Step, string> = {
  1: "Who are you creating this bill for?",
  2: "What are you selling?",
  3: "Anything else on this invoice?",
  4: "Check and generate",
};

/* ---------------- step 1: customer ---------------- */

export function CustomerStep({
  business,
  customers,
  buyer,
  problems,
  onChange,
}: {
  business: Business;
  customers: Customer[];
  buyer: BuyerDraft;
  problems: BuyerProblems;
  onChange: (next: BuyerDraft) => void;
}) {
  const [mode, setMode] = useState<"search" | "form" | "picked">(() =>
    buyer.id ? "picked" : buyer.name.trim() ? "form" : customers.length > 0 ? "search" : "form",
  );
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const digits = needle.replace(/[^0-9]/g, "");
  const matches = customers
    .filter(
      (customer) =>
        !needle ||
        customer.name.toLowerCase().includes(needle) ||
        customer.gstin.toLowerCase().includes(needle) ||
        (digits.length >= 3 && customer.phone.includes(digits)),
    )
    .slice(0, needle ? 8 : 6);

  if (mode === "picked") {
    return (
      <View className="rounded-md border-2 border-ink bg-sheet px-4 py-3.5">
        <BuyerLines business={business} buyer={buyer} />
        <View className="mt-3 flex-row gap-5">
          <TextLink label="Edit details" onPress={() => setMode("form")} />
          <TextLink
            label="Choose someone else"
            onPress={() => {
              onChange(emptyBuyer(business));
              setMode(customers.length > 0 ? "search" : "form");
            }}
          />
        </View>
      </View>
    );
  }

  if (mode === "search") {
    return (
      <View>
        <Field
          label="Search your customers"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, phone or GSTIN"
          autoCorrect={false}
          suffix={
            <View className="pr-2.5">
              <SearchIcon />
            </View>
          }
        />
        <View className="mb-5 border-t border-rule">
          {matches.map((customer) => (
            <Pressable
              key={customer.id}
              accessibilityRole="button"
              onPress={() => {
                onChange({
                  id: customer.id,
                  entity: customer.entity,
                  name: customer.name,
                  phone: customer.phone,
                  gstin: customer.gstin,
                  address: customer.address,
                  state: customer.state || business.state,
                });
                setMode("picked");
              }}
              className="border-b border-rule py-3 active:bg-sheet">
              <AppText variant="semibold">{customer.name}</AppText>
              <AppText size="sm" tone="ink3">
                {[customer.phone, customer.gstin || (customer.entity === "individual" ? "Individual" : "No GSTIN"), customer.state].filter(Boolean).join(", ")}
              </AppText>
            </Pressable>
          ))}
          {matches.length === 0 ? (
            <AppText tone="ink2" className="py-3">
              {`No customer matches "${query.trim()}". Add them as a new customer.`}
            </AppText>
          ) : null}
        </View>
        <Button
          label="Add a new customer"
          variant="line"
          icon="plus"
          onPress={() => {
            const typed = query.trim();
            const startsWithDigit = /^[0-9+]/.test(typed);
            onChange({ ...emptyBuyer(business), name: startsWithDigit ? "" : typed, phone: startsWithDigit ? typed : "" });
            setMode("form");
          }}
        />
      </View>
    );
  }

  return (
    <View>
      {buyer.id ? (
        <AppText tone="ink3" className="mb-4">
          Changes are saved to this customer when you continue.
        </AppText>
      ) : null}
      <BuyerForm business={business} buyer={buyer} problems={problems} onChange={onChange} />
      {customers.length > 0 ? (
        <TextLink
          label={buyer.id ? "Done editing" : "Search saved customers instead"}
          onPress={() => setMode(buyer.id ? "picked" : "search")}
        />
      ) : null}
    </View>
  );
}

function BuyerForm({ business, buyer, problems, onChange }: { business: Business; buyer: BuyerDraft; problems: BuyerProblems; onChange: (next: BuyerDraft) => void }) {
  const [picking, setPicking] = useState(false);
  const sameState = buyer.state === business.state;

  function setGstin(value: string) {
    const gstin = value.toUpperCase().replace(/\s/g, "");
    const fromCode = GSTIN_PATTERN.test(gstin) ? stateFromGstin(gstin) : "";
    onChange({ ...buyer, gstin, state: fromCode || buyer.state });
  }

  return (
    <View>
      <Choices
        label="Customer type"
        value={buyer.entity}
        options={[
          { id: "business", label: "Business" },
          { id: "individual", label: "Individual" },
        ]}
        onChange={(entity) => onChange({ ...buyer, entity, gstin: entity === "business" ? buyer.gstin : "" })}
      />
      <Field
        label={buyer.entity === "business" ? "Business name" : "Customer name"}
        value={buyer.name}
        onChangeText={(name) => onChange({ ...buyer, name })}
        autoCapitalize="words"
        placeholder={buyer.entity === "business" ? "Ravi Traders" : "Ravi Kumar"}
        error={problems.name}
      />
      <Field
        label="Phone"
        hint="Optional. Used to find them next time and to send the bill on WhatsApp."
        value={buyer.phone}
        onChangeText={(phone) => onChange({ ...buyer, phone })}
        keyboardType="phone-pad"
        placeholder="98765 43210"
        error={problems.phone}
      />
      {buyer.entity === "business" ? (
        <Field
          label="GSTIN"
          hint="Optional. Leave blank if they are not registered. The state fills in from the GSTIN."
          value={buyer.gstin}
          onChangeText={setGstin}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          placeholder="27AAAAA0000A1Z5"
          error={problems.gstin}
        />
      ) : null}
      <Field label="Billing address" hint="Optional." value={buyer.address} onChangeText={(address) => onChange({ ...buyer, address })} lines={3} placeholder="Godown 4, Market Yard, Pune" />
      <PickerField
        label="State"
        value={buyer.state}
        placeholder="Choose the state"
        hint={business.gstRegistered ? (sameState ? "Same state as you, so CGST and SGST apply." : "Another state, so IGST applies.") : undefined}
        onPress={() => setPicking(true)}
      />
      <SelectSheet visible={picking} title="State" options={INDIAN_STATES} value={buyer.state} onPick={(state) => onChange({ ...buyer, state })} onClose={() => setPicking(false)} />
    </View>
  );
}

function BuyerLines({ business, buyer }: { business: Business; buyer: BuyerDraft }) {
  return (
    <View>
      <AppText variant="semibold" size="lg">
        {buyer.name.trim() || "Customer"}
      </AppText>
      {buyer.phone.trim() ? <AppText tone="ink2">{buyer.phone.trim()}</AppText> : null}
      {buyer.gstin.trim() ? <AppText tone="ink2">{`GSTIN ${buyer.gstin.trim()}`}</AppText> : null}
      {buyer.address.trim() ? <AppText tone="ink2">{buyer.address.trim()}</AppText> : null}
      <AppText tone="ink3">{buyer.state || business.state}</AppText>
    </View>
  );
}

/* ---------------- step 2: items ---------------- */

export function ItemsStep({
  business,
  items,
  draft,
  bill,
  attempted,
  onDraft,
  onSaveForLater,
}: {
  business: Business;
  items: Item[];
  draft: BillDraft;
  bill: CalculatedBill;
  attempted: boolean;
  onDraft: (patch: Partial<BillDraft>) => void;
  onSaveForLater: (line: LineDraft) => void;
}) {
  const editing = draft.item;

  useEffect(() => {
    if (!draft.item && draft.lines.length === 0) onDraft({ item: emptyItem(business) });
  }, [draft.item, draft.lines.length]);

  function commit(form: ItemForm) {
    const line = lineFromItem(form, business.gstRegistered);
    if (!line) return false;
    const saved: LineDraft = { ...line, key: form.key ?? lineKey() };
    const lines = form.key ? draft.lines.map((existing) => (existing.key === form.key ? saved : existing)) : [...draft.lines, saved];
    onDraft({ lines, item: null });
    if (form.saveForLater && !form.itemId) onSaveForLater(saved);
    return saved;
  }

  return (
    <View>
      {draft.lines.length > 0 ? (
        <View className="mb-5">
          <SectionHead title={`On this bill (${draft.lines.length})`} />
          {draft.lines.map((line, index) => (
            <LineRow
              key={line.key}
              business={business}
              line={line}
              total={bill.lines[index]?.total ?? 0}
              editing={editing?.key === line.key}
              onEdit={() => onDraft({ item: itemFromLine(line) })}
              onDuplicate={() => {
                const copy = { ...line, key: lineKey() };
                const at = draft.lines.findIndex((existing) => existing.key === line.key);
                onDraft({ lines: [...draft.lines.slice(0, at + 1), copy, ...draft.lines.slice(at + 1)] });
              }}
              onRemove={() => onDraft({ lines: draft.lines.filter((existing) => existing.key !== line.key), item: editing?.key === line.key ? null : draft.item })}
            />
          ))}
        </View>
      ) : null}
      {editing ? (
        <ItemEditor
          business={business}
          items={items}
          form={editing}
          attempted={attempted}
          canCancel={draft.lines.length > 0}
          onChange={(item) => onDraft({ item })}
          onDone={commit}
          onCancel={() => onDraft({ item: null })}
        />
      ) : (
        <Button label="Add another item" variant="line" icon="plus" onPress={() => onDraft({ item: emptyItem(business, draft.lines.length ? itemFromLine(draft.lines[draft.lines.length - 1]) : null) })} />
      )}
      {draft.lines.length > 0 ? (
        <View className="mt-6">
          <TotalsBlock business={business} bill={bill} />
        </View>
      ) : null}
    </View>
  );
}

function LineRow({
  business,
  line,
  total,
  editing,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  business: Business;
  line: LineDraft;
  total: number;
  editing: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const unit = unitLabel(line.unit);
  return (
    <View className={`border-b border-rule py-3 ${editing ? "-mx-3 bg-stampsoft px-3" : ""}`}>
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <AppText variant="semibold">{line.name}</AppText>
          {line.description ? (
            <AppText size="sm" tone="ink3">
              {line.description}
            </AppText>
          ) : null}
          <AppText size="sm" tone="ink2">
            {`${lineMeasure(line)} at ${formatMoney(line.unitPrice)}${unit ? ` per ${unit}` : ""}`}
            {business.gstRegistered ? `, GST ${line.gstRate}% ${line.priceMode === "inclusive" ? "included" : "extra"}` : ""}
            {line.discount ? `, ${formatMoney(line.discount)} off` : ""}
          </AppText>
        </View>
        <AppText variant="figure">{formatMoney(total)}</AppText>
      </View>
      {editing ? (
        <AppText size="sm" tone="stamp" className="mt-1.5">
          Changing this item below
        </AppText>
      ) : (
        <View className="mt-1.5 flex-row gap-5">
          <TextLink label="Edit" accessibilityLabel={`Edit ${line.name}`} onPress={onEdit} />
          <TextLink label="Duplicate" accessibilityLabel={`Duplicate ${line.name}`} onPress={onDuplicate} />
          <TextLink label="Remove" accessibilityLabel={`Remove ${line.name}`} tone="cloth" onPress={onRemove} />
        </View>
      )}
    </View>
  );
}

function unitLabel(unit: string): string {
  return UNITS.find((option) => option.id === unit)?.label ?? unit;
}

const OTHER_UNIT = "Other unit";

function ItemEditor({
  business,
  items,
  form,
  attempted,
  canCancel,
  onChange,
  onDone,
  onCancel,
}: {
  business: Business;
  items: Item[];
  form: ItemForm;
  attempted: boolean;
  canCancel: boolean;
  onChange: (next: ItemForm) => void;
  onDone: (form: ItemForm) => LineDraft | false;
  onCancel: () => void;
}) {
  const [tried, setTried] = useState(false);
  const [pickingUnit, setPickingUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState(() => form.unit !== "" && !UNITS.some((unit) => unit.id === form.unit));
  const [otherRate, setOtherRate] = useState(() => !GST_RATES.some((rate) => String(rate) === form.rate));
  const gst = business.gstRegistered;
  const problems = tried || attempted ? itemProblems(form, gst) : {};
  const units = unitsFor(tradeForCategory(business.category));
  const needle = form.name.trim().toLowerCase();
  const suggestions = form.itemId ? [] : items.filter((item) => (needle ? item.name.toLowerCase().includes(needle) && item.name.toLowerCase() !== needle : true)).slice(0, needle ? 4 : 5);
  const line = lineFromItem(form, gst);
  const calculated = line ? calculateLine(line, false, gst) : null;
  const unit = unitLabel(form.unit) || "unit";
  const extras = [form.description, form.hsn, form.discount, form.packs].some((value) => value.trim());

  function done() {
    setTried(true);
    const saved = onDone(form);
    if (saved) setTried(false);
  }

  return (
    <View className="rounded-md border-2 border-ink px-4 pb-1 pt-4">
      <AppText variant="semibold" size="lg" className="mb-3">
        {form.key ? "Change this item" : "Add an item"}
      </AppText>
      <Field label="Item name" value={form.name} onChangeText={(name) => onChange({ ...form, name, itemId: null })} placeholder="Tea, cement, repair work" error={problems.name} />
      {suggestions.length > 0 ? (
        <View className="-mt-3 mb-5">
          <AppText size="sm" tone="ink3" className="mb-1">
            {needle ? "From your saved items" : "Your saved items"}
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Use ${item.name}`}
                onPress={() => {
                  const next = itemFromSaved(business, form, item);
                  setCustomUnit(next.unit !== "" && !UNITS.some((option) => option.id === next.unit));
                  setOtherRate(!GST_RATES.some((rate) => String(rate) === next.rate));
                  onChange(next);
                }}
                className="rounded-md border-2 border-rule2 px-3 py-2 active:bg-sheet">
                <AppText variant="semibold" size="sm">
                  {item.name}
                </AppText>
                <AppText size="xs" tone="ink3">
                  {`${formatMoney(item.price)}${item.unit ? ` per ${unitLabel(item.unit)}` : ""}`}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Quantity" value={form.quantity} onChangeText={(quantity) => onChange({ ...form, quantity })} keyboardType="decimal-pad" placeholder="10" error={problems.quantity} />
        </View>
        <View className="flex-1">
          <PickerField label="Unit" value={customUnit ? OTHER_UNIT : unitLabel(form.unit)} onPress={() => setPickingUnit(true)} />
        </View>
      </View>
      {customUnit ? (
        <Field label="Unit name" value={form.unit} onChangeText={(value) => onChange({ ...form, unit: value })} placeholder="dozen, metre, packet" maxLength={16} autoCorrect={false} />
      ) : null}
      <Field
        label={`Rate per ${unit}`}
        value={form.price}
        onChangeText={(price) => onChange({ ...form, price })}
        keyboardType="decimal-pad"
        prefix="₹"
        placeholder="200"
        error={problems.price}
      />
      {gst ? (
        <View>
          <Choices
            label="GST rate"
            value={otherRate ? "other" : form.rate}
            options={[...GST_RATES.map((rate) => ({ id: String(rate), label: `${rate}%` })), { id: "other", label: "Other" }]}
            onChange={(rate) => {
              if (rate === "other") {
                setOtherRate(true);
                return;
              }
              setOtherRate(false);
              onChange({ ...form, rate, supply: "taxable" });
            }}
          />
          {otherRate ? (
            <Field label="GST rate" value={form.rate} onChangeText={(rate) => onChange({ ...form, rate })} keyboardType="decimal-pad" suffix={<AppText tone="ink2" className="pr-3">%</AppText>} error={problems.rate} />
          ) : null}
          <Choices
            label="The rate you typed"
            value={form.priceMode}
            options={[
              { id: "exclusive", label: "GST extra" },
              { id: "inclusive", label: "Includes GST" },
            ]}
            onChange={(priceMode) => onChange({ ...form, priceMode })}
          />
        </View>
      ) : null}
      {calculated ? (
        <View accessibilityLiveRegion="polite" className="mb-4 rounded-md bg-sheet px-3.5 py-3">
          {gst ? (
            <AppText size="sm" tone="ink2">
              {`Taxable ${formatMoney(calculated.taxableValue)} + GST ${formatMoney(calculated.tax)}`}
            </AppText>
          ) : null}
          <AppText variant="semibold">{`Line total ${formatMoney(calculated.total)}`}</AppText>
        </View>
      ) : null}
      <Disclosure label="Description, HSN, bags and discount" summary="Optional" startOpen={extras}>
        <Field label="Description" hint="Optional. Printed under the item name." value={form.description} onChangeText={(description) => onChange({ ...form, description })} maxLength={160} placeholder="Assam CTC, 1 kg packs" />
        <Field label="HSN or SAC code" hint="Optional." value={form.hsn} onChangeText={(hsn) => onChange({ ...form, hsn })} keyboardType="number-pad" maxLength={8} placeholder="0902" />
        {unitUsesPacks(form.unit) ? (
          <Field label="Bags" hint="Optional. Printed beside the weight; the price uses the quantity." value={form.packs} onChangeText={(packs) => onChange({ ...form, packs })} keyboardType="decimal-pad" placeholder="20" error={problems.packs} />
        ) : null}
        <Field label="Discount on this line" hint="Optional. Taken off before GST." value={form.discount} onChangeText={(discount) => onChange({ ...form, discount })} keyboardType="decimal-pad" prefix="₹" placeholder="0" error={problems.discount} />
      </Disclosure>
      {!form.itemId && !form.key ? (
        <CheckRow
          label="Save to my items for next time"
          hint="Keeps the name, rate and GST. Nothing is saved until you add the item."
          checked={form.saveForLater}
          onChange={(saveForLater) => onChange({ ...form, saveForLater })}
        />
      ) : null}
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Button label={form.key ? "Update item" : "Add to bill"} variant="line" icon={form.key ? "tick" : "plus"} onPress={done} />
        </View>
        {canCancel ? <Button label="Cancel" variant="text" onPress={onCancel} /> : null}
      </View>
      <SelectSheet
        visible={pickingUnit}
        title="Unit"
        options={[...units.map((option) => option.label), OTHER_UNIT]}
        value={customUnit ? OTHER_UNIT : unitLabel(form.unit)}
        searchable={false}
        onPick={(label) => {
          if (label === OTHER_UNIT) {
            setCustomUnit(true);
            onChange({ ...form, unit: "" });
            return;
          }
          setCustomUnit(false);
          onChange({ ...form, unit: units.find((option) => option.label === label)?.id ?? label });
        }}
        onClose={() => setPickingUnit(false)}
      />
    </View>
  );
}

/* ---------------- totals ---------------- */

export function TotalsBlock({ business, bill }: { business: Business; bill: CalculatedBill }) {
  const gst = business.gstRegistered;
  return (
    <View>
      <Leader label="Subtotal" value={formatMoney(bill.subtotal)} />
      {bill.discount > 0 ? <Leader label="Discount" value={`− ${formatMoney(bill.discount)}`} /> : null}
      {gst ? <Leader label="Taxable value" value={formatMoney(bill.taxableValue)} /> : null}
      {gst && !bill.interstate ? <Leader label="CGST" value={formatMoney(bill.cgst)} /> : null}
      {gst && !bill.interstate ? <Leader label="SGST" value={formatMoney(bill.sgst)} /> : null}
      {gst && bill.interstate ? <Leader label="IGST" value={formatMoney(bill.igst)} /> : null}
      {gst ? <Leader label="Total GST" value={formatMoney(bill.tax)} /> : null}
      {bill.roundOff ? <Leader label="Round off" value={`${bill.roundOff > 0 ? "+" : "−"} ${formatMoney(Math.abs(bill.roundOff))}`} /> : null}
      <View className="mt-3">
        <Total label="Total payable" amount={bill.payable} size="md" />
      </View>
    </View>
  );
}

/* ---------------- step 3: details ---------------- */

const PAYMENT_TERMS: { label: string; days: number | null }[] = [
  { label: "None", days: null },
  { label: "Due on receipt", days: 0 },
  { label: "Net 7 days", days: 7 },
  { label: "Net 15 days", days: 15 },
  { label: "Net 30 days", days: 30 },
  { label: "Net 45 days", days: 45 },
];

const METHODS: { id: Method; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
];

export function DetailsStep({
  business,
  draft,
  bill,
  onDraft,
}: {
  business: Business;
  draft: BillDraft;
  bill: CalculatedBill;
  onDraft: (patch: Partial<BillDraft>) => void;
}) {
  const [picking, setPicking] = useState<"issued" | "due" | "terms" | "place" | null>(null);
  const today = indiaToday();
  const paid = Number(draft.amountPaid);
  const place = placeOf(business, draft);
  const termsDays = PAYMENT_TERMS.find((term) => term.label === draft.paymentTerms)?.days;

  function setIssued(issuedOn: string) {
    const dueOn = termsDays != null ? addDays(issuedOn, termsDays) : draft.dueOn && draft.dueOn < issuedOn ? issuedOn : draft.dueOn;
    onDraft({ issuedOn, dueOn });
  }

  return (
    <View>
      <PickerField
        label="Invoice date"
        kind="date"
        value={draft.issuedOn === today ? `Today, ${formatDate(draft.issuedOn)}` : formatDate(draft.issuedOn)}
        onPress={() => setPicking("issued")}
      />
      <Choices
        label="Payment received"
        value={draft.received}
        options={[
          { id: "none" as Received, label: "Not yet" },
          { id: "full" as Received, label: "Paid in full" },
          { id: "part" as Received, label: "Part paid" },
        ]}
        onChange={(received) => onDraft({ received })}
      />
      {draft.received !== "none" ? <Choices label="Paid by" value={draft.method} options={METHODS} onChange={(method) => onDraft({ method })} /> : null}
      {draft.received === "part" ? (
        <Field
          label="Amount paid"
          value={draft.amountPaid}
          onChangeText={(amountPaid) => onDraft({ amountPaid })}
          keyboardType="decimal-pad"
          prefix="₹"
          hint={Number.isFinite(paid) && paid > 0 ? `Balance due ${formatMoney(balanceDue({ amountPaid: paid, payable: bill.payable }))}` : `Total is ${formatMoney(bill.payable)}`}
        />
      ) : null}
      <Disclosure
        label="Due date, PO number and place of supply"
        summary={[draft.dueOn ? `Due ${formatDate(draft.dueOn)}` : "", draft.poNumber ? `PO ${draft.poNumber}` : "", business.gstRegistered ? `Supply in ${place}` : ""].filter(Boolean).join(", ") || "Optional"}
        startOpen={Boolean(draft.dueOn || draft.poNumber || draft.placeOfSupply || draft.paymentTerms)}>
        <PickerField label="Payment terms" value={draft.paymentTerms || "None"} onPress={() => setPicking("terms")} />
        <PickerField
          label="Due date"
          kind="date"
          value={draft.dueOn ? formatDate(draft.dueOn) : ""}
          placeholder="No due date"
          hint={draft.dueOn ? undefined : "Optional."}
          onPress={() => setPicking("due")}
        />
        {draft.dueOn ? (
          <View className="-mt-3 mb-5">
            <TextLink label="Remove due date" onPress={() => onDraft({ dueOn: null, paymentTerms: "" })} />
          </View>
        ) : null}
        <Field label="Purchase order number" hint="Optional." value={draft.poNumber} onChangeText={(poNumber) => onDraft({ poNumber })} autoCapitalize="characters" maxLength={40} placeholder="PO-2291" />
        {business.gstRegistered ? (
          <View>
            <PickerField
              label="Place of supply"
              value={place}
              hint={place === business.state ? "Same state as you, so CGST and SGST apply." : "Another state, so IGST applies."}
              onPress={() => setPicking("place")}
            />
            {draft.placeOfSupply ? (
              <View className="-mt-3 mb-5">
                <TextLink label="Use the customer's state" onPress={() => onDraft({ placeOfSupply: "" })} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Disclosure>
      <Disclosure label="Notes and terms" summary={draft.notes || draft.terms ? "Added" : "Optional"} startOpen={Boolean(draft.notes)}>
        <Field label="Notes" hint="Optional. Printed on this invoice only." value={draft.notes} onChangeText={(notes) => onDraft({ notes })} lines={3} maxLength={500} placeholder="Delivered to Godown 4" />
        <Field
          label="Terms and conditions"
          hint="Starts from your business settings. Changes here are for this invoice only."
          value={draft.terms}
          onChangeText={(terms) => onDraft({ terms })}
          lines={4}
          maxLength={1000}
        />
      </Disclosure>
      <DateSheet visible={picking === "issued"} title="Invoice date" value={draft.issuedOn} max={today} onPick={setIssued} onClose={() => setPicking(null)} />
      <DateSheet
        visible={picking === "due"}
        title="Due date"
        value={draft.dueOn ?? draft.issuedOn}
        min={draft.issuedOn}
        onPick={(dueOn) => onDraft({ dueOn, paymentTerms: "" })}
        onClose={() => setPicking(null)}
      />
      <SelectSheet
        visible={picking === "terms"}
        title="Payment terms"
        options={PAYMENT_TERMS.map((term) => term.label)}
        value={draft.paymentTerms || "None"}
        searchable={false}
        onPick={(label) => {
          const term = PAYMENT_TERMS.find((entry) => entry.label === label);
          if (!term || term.days == null) onDraft({ paymentTerms: "", dueOn: null });
          else onDraft({ paymentTerms: term.label, dueOn: addDays(draft.issuedOn, term.days) });
        }}
        onClose={() => setPicking(null)}
      />
      <SelectSheet
        visible={picking === "place"}
        title="Place of supply"
        options={INDIAN_STATES}
        value={place}
        onPick={(state) => onDraft({ placeOfSupply: state === (draft.buyer.state || business.state) ? "" : state })}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

/* ---------------- step 4: review ---------------- */

const METHOD_LABEL: Record<Method, string> = { cash: "cash", upi: "UPI", card: "card", bank: "bank transfer" };

export function ReviewStep({
  business,
  draft,
  bill,
  onEdit,
  onEditSeller,
}: {
  business: Business;
  draft: BillDraft;
  bill: CalculatedBill;
  onEdit: (step: Step) => void;
  onEditSeller: () => void;
}) {
  const paid = Number(draft.amountPaid);
  const payment =
    draft.received === "none"
      ? "Not paid yet"
      : draft.received === "full"
        ? `Paid in full by ${METHOD_LABEL[draft.method]}`
        : `${formatMoney(Number.isFinite(paid) ? paid : 0)} paid by ${METHOD_LABEL[draft.method]}, ${formatMoney(balanceDue({ amountPaid: Number.isFinite(paid) ? paid : 0, payable: bill.payable }))} due`;

  return (
    <View className="gap-6">
      <ReviewSection title="Invoice" onEdit={() => onEdit(3)}>
        <Leader label="Number" value={invoiceNumber(business.invoicePrefix, business.nextNumber)} />
        <Leader label="Date" value={formatDate(draft.issuedOn)} />
        {draft.dueOn ? <Leader label="Due" value={formatDate(draft.dueOn)} /> : null}
        {draft.poNumber ? <Leader label="PO number" value={draft.poNumber} /> : null}
        {business.gstRegistered ? <Leader label="Place of supply" value={placeOf(business, draft)} /> : null}
        <AppText size="sm" tone="ink3" className="mt-1">
          The number is confirmed when the invoice is generated.
        </AppText>
      </ReviewSection>
      <ReviewSection title="From" onEdit={onEditSeller} editLabel="Edit in settings">
        <AppText variant="semibold">{business.name}</AppText>
        <AppText tone="ink2">{[business.address, business.state].filter(Boolean).join(", ")}</AppText>
        <AppText tone="ink2">{business.gstRegistered ? `GSTIN ${business.gstin}` : "Not registered for GST"}</AppText>
      </ReviewSection>
      <ReviewSection title="Bill to" onEdit={() => onEdit(1)}>
        <BuyerLines business={business} buyer={draft.buyer} />
      </ReviewSection>
      <ReviewSection title={`Items (${draft.lines.length})`} onEdit={() => onEdit(2)}>
        {bill.lines.map((line, index) => (
          <View key={draft.lines[index]?.key ?? index} className="border-b border-rule py-2.5">
            <View className="flex-row items-start justify-between">
              <View className="mr-3 flex-1">
                <AppText variant="semibold">{line.name}</AppText>
                <AppText size="sm" tone="ink2">
                  {`${lineMeasure(line)} at ${formatMoney(line.unitPrice)}`}
                  {business.gstRegistered ? `, taxable ${formatMoney(line.taxableValue)}, GST ${line.gstRate}% ${formatMoney(line.tax)}` : ""}
                </AppText>
              </View>
              <AppText variant="figure">{formatMoney(line.total)}</AppText>
            </View>
          </View>
        ))}
      </ReviewSection>
      <ReviewSection title="Payment and notes" onEdit={() => onEdit(3)}>
        <AppText>{payment}</AppText>
        {draft.notes.trim() ? <AppText tone="ink2">{draft.notes.trim()}</AppText> : null}
        {draft.terms.trim() ? (
          <AppText size="sm" tone="ink3" numberOfLines={2}>
            {draft.terms.trim()}
          </AppText>
        ) : null}
      </ReviewSection>
      <TotalsBlock business={business} bill={bill} />
    </View>
  );
}

function ReviewSection({ title, onEdit, editLabel = "Edit", children }: { title: string; onEdit: () => void; editLabel?: string; children: ReactNode }) {
  return (
    <View>
      <SectionHead title={title} right={<TextLink label={editLabel} accessibilityLabel={`${editLabel}: ${title}`} onPress={onEdit} />} />
      <View className="pt-1.5">{children}</View>
    </View>
  );
}
