import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Switch, View } from "react-native";

import { AppText } from "@/components/app-text";
import { SectionHead } from "@/components/book";
import { Button } from "@/components/button";
import { Disclosure } from "@/components/disclosure";
import { Field, PickerField } from "@/components/field";
import { SelectSheet } from "@/components/select-sheet";
import { TextLink } from "@/components/text-link";
import { Choices } from "@/billing/choices";
import { GSTIN_PATTERN, GST_RATES, INDIAN_STATES, invoiceNumber, stateFromGstin } from "@/billing/engine";
import type { Business, BusinessInput, InvoiceLayout, PriceMode } from "@/billing/engine";
import { colors } from "@/lib/theme";

export type BusinessDraft = {
  name: string;
  category: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  logo: string;
  gstRegistered: boolean;
  gstin: string;
  invoicePrefix: string;
  defaultPriceMode: PriceMode;
  defaultGstRate: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  terms: string;
  footer: string;
  layout: InvoiceLayout;
  showHsn: boolean;
  roundOff: boolean;
};

export const emptyBusinessDraft: BusinessDraft = {
  name: "",
  category: "",
  address: "",
  state: "",
  phone: "",
  email: "",
  logo: "",
  gstRegistered: false,
  gstin: "",
  invoicePrefix: "INV",
  defaultPriceMode: "exclusive",
  defaultGstRate: "5",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  upiId: "",
  terms: "",
  footer: "",
  layout: "standard",
  showHsn: true,
  roundOff: true,
};

export function draftFromBusiness(business: Business): BusinessDraft {
  return {
    name: business.name,
    category: business.category,
    address: business.address,
    state: business.state,
    phone: business.phone,
    email: business.email,
    logo: business.logo,
    gstRegistered: business.gstRegistered,
    gstin: business.gstin,
    invoicePrefix: business.invoicePrefix,
    defaultPriceMode: business.defaultPriceMode,
    defaultGstRate: String(business.defaultGstRate),
    bankName: business.bankName,
    bankAccount: business.bankAccount,
    bankIfsc: business.bankIfsc,
    upiId: business.upiId,
    terms: business.terms,
    footer: business.footer,
    layout: business.layout,
    showHsn: business.showHsn,
    roundOff: business.roundOff,
  };
}

/** Logos are shrunk on the phone to about 320 px wide, so each one stays well under the server's limit. */
async function pickLogo(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 });
  if (picked.canceled || !picked.assets[0]) return null;
  const context = ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize({ width: 320 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!saved.base64) throw new Error("The logo could not be read.");
  const url = `data:image/png;base64,${saved.base64}`;
  if (url.length > 400000) throw new Error("That logo is too detailed. Choose a simpler image.");
  return url;
}

/**
 * Everything printed at the top and bottom of every invoice.
 * At setup, only what the first invoice needs is open; the rest waits in Settings.
 */
export function BusinessForm({
  draft,
  onChange,
  nextNumber,
  setup = false,
}: {
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  nextNumber?: number;
  setup?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const patch = (partial: Partial<BusinessDraft>) => onChange({ ...draft, ...partial });
  const hasBank = Boolean(draft.bankName || draft.bankAccount || draft.bankIfsc || draft.upiId);

  async function chooseLogo() {
    setLogoError(null);
    setLoadingLogo(true);
    try {
      const logo = await pickLogo();
      if (logo) patch({ logo });
    } catch (caught) {
      setLogoError(caught instanceof Error ? caught.message : "The logo could not be added.");
    } finally {
      setLoadingLogo(false);
    }
  }

  const look = (
    <View>
      <AppText variant="medium" size="sm" tone="ink2" className="mb-1.5">
        Logo
      </AppText>
      <View className="mb-5 flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-md border-2 border-rule2 bg-sheet">
          {draft.logo ? <Image source={{ uri: draft.logo }} style={{ width: 60, height: 60 }} resizeMode="contain" accessibilityLabel="Your logo" /> : <AppText tone="faint" size="xs">None</AppText>}
        </View>
        <View className="flex-1 gap-2">
          <Button label={draft.logo ? "Change logo" : "Add logo"} variant="line" small loading={loadingLogo} onPress={chooseLogo} />
          {draft.logo ? <TextLink label="Remove logo" tone="cloth" onPress={() => patch({ logo: "" })} /> : null}
        </View>
      </View>
      {logoError ? (
        <AppText tone="cloth" className="-mt-3 mb-4">
          {logoError}
        </AppText>
      ) : null}
      <Choices
        label="Invoice layout"
        value={draft.layout}
        options={[
          { id: "standard", label: "Standard" },
          { id: "compact", label: "Compact" },
        ]}
        onChange={(layout) => patch({ layout })}
      />
      <AppText size="sm" tone="ink3" className="-mt-3 mb-4">
        {draft.layout === "standard" ? "Taxable value and GST in their own columns." : "Fewer columns and smaller type. GST is shown under each item."}
      </AppText>
      <ToggleRow label="Show the HSN/SAC column" hint="Only appears when an item has a code." value={draft.showHsn} onChange={(showHsn) => patch({ showHsn })} />
      <ToggleRow label="Round the total to the nearest rupee" hint="The difference is printed as round off." value={draft.roundOff} onChange={(roundOff) => patch({ roundOff })} />
    </View>
  );

  const bank = (
    <View>
      <Field label="Bank name" hint="Optional." value={draft.bankName} onChangeText={(bankName) => patch({ bankName })} placeholder="State Bank of India" />
      <Field label="Account number" hint="Optional." value={draft.bankAccount} onChangeText={(bankAccount) => patch({ bankAccount: bankAccount.replace(/\s/g, "") })} keyboardType="number-pad" maxLength={20} />
      <Field label="IFSC" hint="Optional." value={draft.bankIfsc} onChangeText={(bankIfsc) => patch({ bankIfsc: bankIfsc.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="SBIN0001234" />
      <Field label="UPI ID" hint="Optional." value={draft.upiId} onChangeText={(upiId) => patch({ upiId: upiId.trim() })} autoCapitalize="none" autoCorrect={false} placeholder="shop@upi" />
    </View>
  );

  const words = (
    <View>
      <Field
        label="Terms and conditions"
        hint="Optional. Starts every new invoice; you can change it on one invoice."
        value={draft.terms}
        onChangeText={(terms) => patch({ terms })}
        lines={4}
        maxLength={1000}
        placeholder="Goods once sold will not be taken back."
      />
      <Field label="Footer" hint="Optional. One line at the bottom of every page." value={draft.footer} onChangeText={(footer) => patch({ footer })} maxLength={160} placeholder="Thank you for your business" />
    </View>
  );

  return (
    <View>
      <SectionHead title="Business" />
      <View className="pt-4">
        <Field label="Business name" value={draft.name} onChangeText={(name) => patch({ name })} placeholder="Sharma Tea House" />
        <Field
          label="What do you sell?"
          value={draft.category}
          onChangeText={(category) => patch({ category })}
          placeholder="Tea, clothes, repairs"
          hint="Only a label. It suggests units; it does not choose the GST rate."
        />
        <Field label="Address" value={draft.address} onChangeText={(address) => patch({ address })} lines={2} placeholder="Shop 12, MG Road, Pune" />
        <PickerField label="State" value={draft.state} placeholder="Choose the state" onPress={() => setPicking(true)} />
        <Field label="Phone" hint="Optional." value={draft.phone} onChangeText={(phone) => patch({ phone })} keyboardType="phone-pad" placeholder="98765 43210" />
        <Field label="Email" hint="Optional." value={draft.email} onChangeText={(email) => patch({ email: email.trim() })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="accounts@shop.in" />
      </View>

      <SectionHead title="GST" />
      <View className="pt-4">
        <Choices
          label="GST registration"
          value={draft.gstRegistered ? "yes" : "no"}
          options={[
            { id: "no", label: "Not registered" },
            { id: "yes", label: "GST registered" },
          ]}
          onChange={(id) => patch({ gstRegistered: id === "yes" })}
        />
        {draft.gstRegistered ? (
          <View>
            <Field
              label="GSTIN"
              value={draft.gstin}
              onChangeText={(value) => {
                const gstin = value.toUpperCase().replace(/\s/g, "");
                const fromCode = GSTIN_PATTERN.test(gstin) ? stateFromGstin(gstin) : "";
                patch({ gstin, state: draft.state || fromCode });
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={15}
              placeholder="27AAAAA0000A1Z5"
            />
            <Choices
              label="Usual price"
              value={draft.defaultPriceMode}
              options={[
                { id: "exclusive", label: "Add GST on top" },
                { id: "inclusive", label: "Price includes GST" },
              ]}
              onChange={(defaultPriceMode) => patch({ defaultPriceMode })}
            />
            <Choices
              label="Usual GST rate"
              value={GST_RATES.some((rate) => String(rate) === draft.defaultGstRate) ? draft.defaultGstRate : ""}
              options={GST_RATES.map((rate) => ({ id: String(rate), label: `${rate}%` }))}
              onChange={(defaultGstRate) => patch({ defaultGstRate })}
            />
            <Field
              label="Or type a rate"
              value={draft.defaultGstRate}
              onChangeText={(defaultGstRate) => patch({ defaultGstRate })}
              keyboardType="decimal-pad"
              suffix={<AppText tone="ink2" className="pr-3">%</AppText>}
              hint="Each item can still have its own rate."
            />
          </View>
        ) : (
          <AppText tone="ink2" className="mb-5">
            Invoices will not add GST. You can turn this on later without changing old invoices.
          </AppText>
        )}
      </View>

      <SectionHead title="Invoice numbers" />
      <View className="pt-4">
        <Field
          label="Invoice prefix"
          value={draft.invoicePrefix}
          onChangeText={(invoicePrefix) => patch({ invoicePrefix: invoicePrefix.toUpperCase() })}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="INV"
          hint={`The next invoice will be ${invoiceNumber(draft.invoicePrefix.trim().toUpperCase() || "INV", nextNumber ?? 1)}. Numbers are never reused.`}
        />
      </View>

      {setup ? (
        <Disclosure label="Logo, bank details and terms" summary="Optional. You can add these later in Settings.">
          {look}
          {bank}
          {words}
        </Disclosure>
      ) : (
        <View>
          <SectionHead title="Invoice look" />
          <View className="pt-4">{look}</View>
          <Disclosure label="Bank and UPI details" summary={hasBank ? "Printed under the total" : "Optional"} startOpen={hasBank}>
            {bank}
          </Disclosure>
          <Disclosure label="Terms and footer" summary={draft.terms || draft.footer ? "Added" : "Optional"} startOpen={Boolean(draft.terms || draft.footer)}>
            {words}
          </Disclosure>
        </View>
      )}
      <SelectSheet visible={picking} title="State" options={INDIAN_STATES} value={draft.state} onPick={(state) => patch({ state })} onClose={() => setPicking(false)} />
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="mb-4 flex-row items-center justify-between gap-4">
      <View className="flex-1">
        <AppText>{label}</AppText>
        {hint ? (
          <AppText size="sm" tone="ink3">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.stamp, false: colors.rule2 }} thumbColor={colors.paper} accessibilityLabel={label} />
    </View>
  );
}

/** The draft as the invoice would print it, even before it is valid. Used for the template preview. */
export function looseBusinessInput(draft: BusinessDraft): BusinessInput {
  const rate = Number(draft.defaultGstRate);
  return {
    ...draft,
    name: draft.name.trim(),
    invoicePrefix: draft.invoicePrefix.trim().toUpperCase() || "INV",
    gstin: draft.gstRegistered ? draft.gstin.trim().toUpperCase() : "",
    defaultGstRate: draft.gstRegistered && Number.isFinite(rate) ? rate : 0,
  };
}

export function readBusinessDraft(draft: BusinessDraft): { ok: true; value: BusinessInput } | { ok: false; error: string } {
  const rate = Number(draft.defaultGstRate);
  if (!draft.name.trim()) return { ok: false, error: "Enter the business name." };
  if (!draft.state) return { ok: false, error: "Choose the state from the list." };
  if (!/^[A-Za-z0-9]{1,8}$/.test(draft.invoicePrefix.trim())) return { ok: false, error: "Use letters and numbers for the invoice prefix." };
  if (draft.gstRegistered && !GSTIN_PATTERN.test(draft.gstin.trim().toUpperCase())) return { ok: false, error: "Enter a 15-character GSTIN." };
  if (draft.gstRegistered && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return { ok: false, error: "Enter a GST rate from 0 to 100." };
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return { ok: false, error: "Enter an email like name@shop.in, or leave it blank." };
  if (draft.bankAccount && !/^[0-9]{6,20}$/.test(draft.bankAccount)) return { ok: false, error: "Use only digits for the account number." };
  if (draft.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(draft.bankIfsc)) return { ok: false, error: "Enter an 11-character IFSC like SBIN0001234." };
  if (draft.upiId && !/^[\w.-]+@[\w.-]+$/.test(draft.upiId)) return { ok: false, error: "Enter a UPI ID like shop@upi." };
  return {
    ok: true,
    value: {
      ...looseBusinessInput(draft),
      category: draft.category.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      terms: draft.terms.trim(),
      footer: draft.footer.trim(),
    },
  };
}
