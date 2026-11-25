import AsyncStorage from "@react-native-async-storage/async-storage";

import { INDIAN_STATES } from "@/billing/engine";
import type { OrganisationProfile } from "@/lib/types";

export const INDUSTRIES = [
  "Grocery or kirana",
  "Food or tea stall",
  "Clothing",
  "Workshop or fabrication",
  "Salon",
  "Pharmacy",
  "Electronics",
  "Building work",
  "Transport",
  "Tuition or school",
  "Clinic",
  "Wholesale",
  "Office or services",
  "Other",
] as const;

export const COUNTRIES = [
  "India",
  "Nepal",
  "Bangladesh",
  "Bhutan",
  "Sri Lanka",
  "UAE",
  "Singapore",
  "United States",
  "United Kingdom",
  "Other",
] as const;

export type OrganisationDraft = {
  name: string;
  industry: string;
  industryOther: string;
  description: string;
  country: string;
  countryOther: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
  contactName: string;
  phone: string;
  email: string;
};

export type SetupStep = 1 | 2 | 3 | 4;

export type SavedSetup = {
  step: SetupStep;
  draft: OrganisationDraft;
};

const STEP_FIELDS: Record<Exclude<SetupStep, 4>, (keyof OrganisationDraft)[]> = {
  1: ["name", "industry", "industryOther", "description"],
  2: ["country", "countryOther", "state", "city", "address", "postalCode"],
  3: ["contactName", "phone", "email"],
};

export function blankDraft(admin: { name: string; email: string }): OrganisationDraft {
  return {
    name: "",
    industry: "",
    industryOther: "",
    description: "",
    country: "India",
    countryOther: "",
    state: "",
    city: "",
    address: "",
    postalCode: "",
    contactName: admin.name,
    phone: "",
    email: admin.email,
  };
}

export function draftFromProfile(profile: OrganisationProfile): OrganisationDraft {
  const industryKnown = (INDUSTRIES as readonly string[]).includes(profile.industry);
  const countryKnown = (COUNTRIES as readonly string[]).includes(profile.country);
  return {
    name: profile.name,
    industry: profile.industry === "" ? "" : industryKnown ? profile.industry : "Other",
    industryOther: industryKnown ? "" : profile.industry,
    description: profile.description,
    country: profile.country === "" ? "India" : countryKnown ? profile.country : "Other",
    countryOther: countryKnown || profile.country === "" ? "" : profile.country,
    state: profile.state,
    city: profile.city,
    address: profile.address,
    postalCode: profile.postalCode,
    contactName: profile.contactName,
    phone: profile.phone,
    email: profile.email,
  };
}

export function resolvedIndustry(draft: OrganisationDraft): string {
  return (draft.industry === "Other" ? draft.industryOther : draft.industry).trim();
}

export function resolvedCountry(draft: OrganisationDraft): string {
  return (draft.country === "Other" ? draft.countryOther : draft.country).trim();
}

export function fieldErrors(draft: OrganisationDraft): Partial<Record<keyof OrganisationDraft, string>> {
  const errors: Partial<Record<keyof OrganisationDraft, string>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Give this workplace a name.";
  else if (name.length > 80) errors.name = "Keep the name under 80 letters.";

  if (!draft.industry) errors.industry = "Choose what kind of work this is.";
  else if (draft.industry === "Other" && !draft.industryOther.trim()) errors.industryOther = "Say what kind of work this is.";
  else if (resolvedIndustry(draft).length > 80) errors.industryOther = "Keep the type of work under 80 letters.";

  const country = resolvedCountry(draft);
  if (!draft.country) errors.country = "Choose a country.";
  else if (draft.country === "Other" && !country) errors.countryOther = "Enter the country.";
  else if (country.length > 60) errors.countryOther = "Keep the country under 60 letters.";

  const state = draft.state.trim();
  if (!state) errors.state = country === "India" ? "Choose a state." : "Enter the state.";
  else if (country === "India" && !(INDIAN_STATES as readonly string[]).includes(state)) errors.state = "Choose a state in India.";
  else if (state.length > 80) errors.state = "Keep the state under 80 letters.";

  const city = draft.city.trim();
  if (!city) errors.city = "Enter the city.";
  else if (city.length > 80) errors.city = "Keep the city under 80 letters.";

  const address = draft.address.trim();
  if (!address) errors.address = "Enter the shop or office address.";
  else if (address.length > 240) errors.address = "Keep the address under 240 letters.";

  const postal = draft.postalCode.trim();
  if (country === "India" && postal && !/^\d{6}$/.test(postal)) errors.postalCode = "Enter a 6-digit PIN code, or leave it blank.";
  else if (postal.length > 12) errors.postalCode = "Keep the postal code under 12 characters.";

  const contact = draft.contactName.trim();
  if (!contact) errors.contactName = "Enter the owner's name.";
  else if (contact.length > 80) errors.contactName = "Keep the name under 80 letters.";

  const digits = draft.phone.replace(/\D/g, "");
  if (!draft.phone.trim()) errors.phone = "Enter a phone number.";
  else if (digits.length < 8 || digits.length > 15) errors.phone = "Enter a phone number we can call.";

  const email = draft.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email, or leave it blank.";
  else if (email.length > 200) errors.email = "That email is too long.";

  return errors;
}

export function errorsForStep(step: SetupStep, draft: OrganisationDraft): Partial<Record<keyof OrganisationDraft, string>> {
  if (step === 4) return fieldErrors(draft);
  const relevant = new Set(STEP_FIELDS[step]);
  const errors = fieldErrors(draft);
  for (const key of Object.keys(errors) as (keyof OrganisationDraft)[]) {
    if (!relevant.has(key)) delete errors[key];
  }
  return errors;
}

export function toProfile(draft: OrganisationDraft): OrganisationProfile | null {
  if (Object.keys(fieldErrors(draft)).length > 0) return null;
  return {
    name: draft.name.trim(),
    industry: resolvedIndustry(draft),
    description: draft.description.trim(),
    country: resolvedCountry(draft),
    state: draft.state.trim(),
    city: draft.city.trim(),
    address: draft.address.trim(),
    postalCode: draft.postalCode.trim(),
    contactName: draft.contactName.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
  };
}

export function hasProgress(draft: OrganisationDraft, admin: { name: string; email: string }): boolean {
  const fresh = blankDraft(admin);
  return (Object.keys(fresh) as (keyof OrganisationDraft)[]).some((key) => draft[key].trim() !== fresh[key].trim());
}

function storageKey(adminId: string): string {
  return `salaryapp.orgDraft.${adminId}`;
}

export async function loadSetup(adminId: string): Promise<SavedSetup | null> {
  try {
    const saved = await AsyncStorage.getItem(storageKey(adminId));
    if (!saved) return null;
    const parsed = JSON.parse(saved) as SavedSetup;
    if (!parsed?.draft || parsed.step < 1 || parsed.step > 4) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSetup(adminId: string, setup: SavedSetup): Promise<void> {
  await AsyncStorage.setItem(storageKey(adminId), JSON.stringify(setup)).catch(() => undefined);
}

export async function clearSetup(adminId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(adminId)).catch(() => undefined);
}
