import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Field, PickerField } from "@/components/field";
import { SelectSheet } from "@/components/select-sheet";
import { INDIAN_STATES } from "@/billing/engine";
import { COUNTRIES, INDUSTRIES, resolvedCountry, resolvedIndustry, type OrganisationDraft } from "@/organisation/profile";

type Errors = Partial<Record<keyof OrganisationDraft, string>>;

export function CompanyFields({
  draft,
  errors,
  onChange,
}: {
  draft: OrganisationDraft;
  errors: Errors;
  onChange: (next: OrganisationDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const patch = (partial: Partial<OrganisationDraft>) => onChange({ ...draft, ...partial });

  return (
    <View>
      <Field
        label="Workplace name"
        value={draft.name}
        onChangeText={(name) => patch({ name })}
        autoCapitalize="words"
        maxLength={80}
        placeholder="Sharma Fabrication Works"
        error={errors.name}
      />
      <PickerField
        label="What kind of work is this?"
        value={draft.industry}
        error={errors.industry}
        onPress={() => setOpen(true)}
      />
      {draft.industry === "Other" ? (
        <Field
          label="Describe the work"
          value={draft.industryOther}
          onChangeText={(industryOther) => patch({ industryOther })}
          maxLength={80}
          placeholder="Printing, repairs, coaching"
          error={errors.industryOther}
        />
      ) : null}
      <SelectSheet
        visible={open}
        title="What kind of work?"
        options={INDUSTRIES}
        value={draft.industry}
        onPick={(industry) => patch({ industry })}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

export function AddressFields({
  draft,
  errors,
  onChange,
}: {
  draft: OrganisationDraft;
  errors: Errors;
  onChange: (next: OrganisationDraft) => void;
}) {
  const [picking, setPicking] = useState<"country" | "state" | null>(null);
  const country = resolvedCountry(draft);
  const patch = (partial: Partial<OrganisationDraft>) => onChange({ ...draft, ...partial });

  return (
    <View>
      <PickerField label="Country" value={draft.country} error={errors.country} onPress={() => setPicking("country")} />
      {draft.country === "Other" ? (
        <Field
          label="Country name"
          value={draft.countryOther}
          onChangeText={(countryOther) => patch({ countryOther })}
          maxLength={60}
          error={errors.countryOther}
        />
      ) : null}
      {country === "India" ? (
        <PickerField label="State" value={draft.state} error={errors.state} onPress={() => setPicking("state")} />
      ) : (
        <Field
          label="State"
          value={draft.state}
          onChangeText={(state) => patch({ state })}
          maxLength={80}
          autoCapitalize="words"
          error={errors.state}
        />
      )}
      <Field label="City" value={draft.city} onChangeText={(city) => patch({ city })} maxLength={80} autoCapitalize="words" placeholder="Pune" error={errors.city} />
      <Field
        label="Full address"
        value={draft.address}
        onChangeText={(address) => patch({ address })}
        lines={3}
        maxLength={240}
        placeholder="Shop 12, MG Road"
        error={errors.address}
      />
      <Field
        label={country === "India" ? "PIN code" : "Postal code"}
        hint="Optional."
        value={draft.postalCode}
        onChangeText={(postalCode) => patch({ postalCode })}
        keyboardType={country === "India" ? "number-pad" : "default"}
        maxLength={country === "India" ? 6 : 12}
        placeholder={country === "India" ? "411001" : ""}
        error={errors.postalCode}
      />
      <SelectSheet
        visible={picking === "country"}
        title="Country"
        options={COUNTRIES}
        value={draft.country}
        onPick={(next) => patch({ country: next, state: next === draft.country ? draft.state : "" })}
        onClose={() => setPicking(null)}
      />
      <SelectSheet
        visible={picking === "state"}
        title="State"
        options={INDIAN_STATES}
        value={draft.state}
        onPick={(state) => patch({ state })}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

export function ContactFields({
  draft,
  errors,
  onChange,
}: {
  draft: OrganisationDraft;
  errors: Errors;
  onChange: (next: OrganisationDraft) => void;
}) {
  const patch = (partial: Partial<OrganisationDraft>) => onChange({ ...draft, ...partial });
  return (
    <View>
      <Field
        label="Owner name"
        value={draft.contactName}
        onChangeText={(contactName) => patch({ contactName })}
        autoCapitalize="words"
        maxLength={80}
        error={errors.contactName}
      />
      <Field
        label="Phone"
        value={draft.phone}
        onChangeText={(phone) => patch({ phone })}
        keyboardType="phone-pad"
        maxLength={20}
        placeholder="98765 43210"
        error={errors.phone}
      />
      <Field
        label="Email"
        hint="Optional. Bills can show this address."
        value={draft.email}
        onChangeText={(email) => patch({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={200}
        error={errors.email}
      />
    </View>
  );
}

export function ReviewList({
  draft,
  onEdit,
}: {
  draft: OrganisationDraft;
  onEdit: (step: 1 | 2 | 3) => void;
}) {
  const country = resolvedCountry(draft);
  const address = [draft.address.trim(), draft.city.trim(), draft.state.trim(), draft.postalCode.trim(), country]
    .filter(Boolean)
    .join(", ");

  return (
    <View className="gap-3">
      <ReviewSection title="The workplace" onEdit={() => onEdit(1)} lines={[draft.name.trim(), resolvedIndustry(draft)]} />
      <ReviewSection title="The address" onEdit={() => onEdit(2)} lines={[address]} />
      <ReviewSection
        title="Who to call"
        onEdit={() => onEdit(3)}
        lines={[draft.contactName.trim(), draft.phone.trim(), draft.email.trim() || "No email added"]}
      />
    </View>
  );
}

function ReviewSection({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  return (
    <View className="rounded-md border-2 border-ink bg-sheet px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <AppText variant="semibold" size="lg">
          {title}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change ${title}`} onPress={onEdit} hitSlop={8}>
          <AppText variant="semibold" size="sm" style={{ textDecorationLine: "underline" }}>
            Change
          </AppText>
        </Pressable>
      </View>
      {lines.map((line, index) => (
        <AppText key={`${title}-${index}`} tone="ink2" className="mt-1">
          {line}
        </AppText>
      ))}
    </View>
  );
}
