import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  GSTIN_PATTERN,
  calculateBill,
  indiaToday,
  invoiceNumber,
  isInterstate,
  sellerSnapshot,
  stateFromGstin,
  tradeForCategory,
  unitUsesPacks,
  unitsFor,
  type Business,
  type BusinessInput,
  type CalculatedBill,
  type Customer,
  type CustomerEntity,
  type CustomerInput,
  type Invoice,
  type InvoiceDocument,
  type InvoiceInput,
  type Item,
  type LineInput,
  type Payment,
  type PriceMode,
  type Supply,
} from "@/billing/engine";

export type Step = 1 | 2 | 3 | 4;

export const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "Customer" },
  { step: 2, label: "Items" },
  { step: 3, label: "Details" },
  { step: 4, label: "Review" },
];

export type BuyerDraft = {
  id: string | null;
  entity: CustomerEntity;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  state: string;
};

export type LineDraft = LineInput & { key: string };

/** The item being typed. Kept as text so a half-typed number is not lost. */
export type ItemForm = {
  /** The line being changed, or null for a new one. */
  key: string | null;
  name: string;
  description: string;
  hsn: string;
  quantity: string;
  unit: string;
  packs: string;
  price: string;
  rate: string;
  priceMode: PriceMode;
  discount: string;
  supply: Supply;
  itemId: string | null;
  saveForLater: boolean;
};

export type Received = "none" | "full" | "part";
export type Method = Exclude<Payment, "unpaid">;

/** Everything about the bill being made. The preview, the review and the saved invoice all read this. */
export type BillDraft = {
  version: 2;
  ref: string;
  step: Step;
  buyer: BuyerDraft;
  lines: LineDraft[];
  item: ItemForm | null;
  issuedOn: string;
  dueOn: string | null;
  paymentTerms: string;
  poNumber: string;
  placeOfSupply: string;
  notes: string;
  terms: string;
  received: Received;
  method: Method;
  amountPaid: string;
  updatedAt: string;
};

/** Random v4 UUID. Used once per draft so a retried save cannot make two invoices. */
export function newRef(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) out += "-";
    else if (index === 14) out += "4";
    else if (index === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export function lineKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBuyer(business: Business): BuyerDraft {
  return { id: null, entity: "business", name: "", phone: "", gstin: "", address: "", state: business.state };
}

export function buyerFromCustomer(customer: Customer): BuyerDraft {
  return {
    id: customer.id,
    entity: customer.entity,
    name: customer.name,
    phone: customer.phone,
    gstin: customer.gstin,
    address: customer.address,
    state: customer.state,
  };
}

export function emptyItem(business: Business, previous?: ItemForm | null): ItemForm {
  return {
    key: null,
    name: "",
    description: "",
    hsn: "",
    quantity: "",
    unit: previous?.unit ?? unitsFor(tradeForCategory(business.category))[0]?.id ?? "units",
    packs: "",
    price: "",
    rate: previous?.rate ?? String(business.defaultGstRate),
    priceMode: previous?.priceMode ?? business.defaultPriceMode,
    discount: "",
    supply: business.gstRegistered ? "taxable" : "non-gst",
    itemId: null,
    saveForLater: false,
  };
}

export function itemFromSaved(business: Business, form: ItemForm, item: Item): ItemForm {
  return {
    ...form,
    name: item.name,
    description: item.description,
    hsn: item.hsn,
    unit: item.unit || form.unit,
    price: String(item.price),
    rate: String(item.gstRate),
    priceMode: item.priceMode,
    supply: business.gstRegistered ? item.supply : "non-gst",
    itemId: item.id,
    saveForLater: false,
  };
}

export function itemFromLine(line: LineDraft): ItemForm {
  return {
    key: line.key,
    name: line.name,
    description: line.description,
    hsn: line.hsn,
    quantity: String(line.quantity),
    unit: line.unit,
    packs: line.packs == null ? "" : String(line.packs),
    price: String(line.unitPrice),
    rate: String(line.gstRate),
    priceMode: line.priceMode,
    discount: line.discount ? String(line.discount) : "",
    supply: line.supply,
    itemId: line.itemId,
    saveForLater: false,
  };
}

export function newDraft(business: Business): BillDraft {
  return {
    version: 2,
    ref: newRef(),
    step: 1,
    buyer: emptyBuyer(business),
    lines: [],
    item: null,
    issuedOn: indiaToday(),
    dueOn: null,
    paymentTerms: "",
    poNumber: "",
    placeOfSupply: "",
    notes: "",
    terms: business.terms,
    received: "none",
    method: "cash",
    amountPaid: "",
    updatedAt: new Date().toISOString(),
  };
}

/** A new draft that copies the customer, items and notes of an earlier invoice. */
export function draftFromInvoice(business: Business, invoice: Invoice): BillDraft {
  return {
    ...newDraft(business),
    step: 2,
    buyer: {
      id: invoice.customerId,
      entity: invoice.customerGstin ? "business" : "individual",
      name: invoice.customerName,
      phone: invoice.customerPhone,
      gstin: invoice.customerGstin,
      address: invoice.customerAddress,
      state: invoice.customerState || business.state,
    },
    lines: invoice.lines.map((line) => ({
      key: lineKey(),
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: business.gstRegistered ? line.gstRate : 0,
      priceMode: line.priceMode,
      discount: line.discount,
      supply: business.gstRegistered ? line.supply : "non-gst",
      hsn: line.hsn,
      unit: line.unit,
      packs: line.packs,
      packUnit: line.packUnit,
      itemId: line.itemId,
    })),
    placeOfSupply: invoice.placeOfSupply && invoice.placeOfSupply !== invoice.customerState ? invoice.placeOfSupply : "",
    notes: invoice.notes,
    terms: invoice.terms || business.terms,
    paymentTerms: invoice.paymentTerms,
  };
}

/* ---------------- reading the item form ---------------- */

function number(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text.replace(/,/g, ""));
}

export type ItemProblems = Partial<Record<"name" | "quantity" | "price" | "rate" | "packs" | "discount", string>>;

export function itemProblems(form: ItemForm, gstRegistered: boolean): ItemProblems {
  const problems: ItemProblems = {};
  const quantity = number(form.quantity);
  const price = number(form.price);
  const rate = number(form.rate);
  const packs = number(form.packs);
  const discount = number(form.discount);
  if (!form.name.trim()) problems.name = "Enter the item name.";
  if (!Number.isFinite(quantity) || quantity <= 0) problems.quantity = "Enter how many.";
  if (!Number.isFinite(price) || price < 0) problems.price = "Enter the rate.";
  if (gstRegistered && form.supply === "taxable" && (!Number.isFinite(rate) || rate < 0 || rate > 100)) problems.rate = "Enter a GST rate from 0 to 100.";
  if (form.packs.trim() && (!Number.isFinite(packs) || packs <= 0)) problems.packs = "Enter the bags, or leave it blank.";
  if (form.discount.trim()) {
    if (!Number.isFinite(discount) || discount < 0) problems.discount = "Enter the discount in rupees.";
    else if (Number.isFinite(quantity) && Number.isFinite(price) && discount > quantity * price) problems.discount = "The discount is more than the line amount.";
  }
  return problems;
}

/** The form as a bill line, or null while it is incomplete. */
export function lineFromItem(form: ItemForm, gstRegistered: boolean): LineDraft | null {
  if (Object.keys(itemProblems(form, gstRegistered)).length > 0) return null;
  const packs = form.packs.trim() && unitUsesPacks(form.unit) ? number(form.packs) : null;
  const taxable = gstRegistered && form.supply === "taxable";
  return {
    key: form.key ?? "editing",
    name: form.name.trim(),
    description: form.description.trim(),
    quantity: number(form.quantity),
    unitPrice: number(form.price),
    gstRate: taxable ? number(form.rate) : 0,
    priceMode: form.priceMode,
    discount: form.discount.trim() ? number(form.discount) : 0,
    supply: gstRegistered ? form.supply : "non-gst",
    hsn: form.hsn.trim(),
    unit: form.unit.trim(),
    packs,
    packUnit: packs != null ? "bags" : "",
    itemId: form.itemId,
  };
}

/** Lines as the preview should show them: the item being typed appears in place as soon as it adds up. */
export function previewLines(draft: BillDraft, gstRegistered: boolean): LineDraft[] {
  if (!draft.item) return draft.lines;
  const typed = lineFromItem(draft.item, gstRegistered);
  if (!typed) return draft.lines;
  if (draft.item.key) return draft.lines.map((line) => (line.key === draft.item?.key ? typed : line));
  return [...draft.lines, typed];
}

/* ---------------- customer ---------------- */

export function buyerKind(buyer: BuyerDraft): CustomerInput["kind"] {
  return buyer.gstin.trim() ? "registered" : "unregistered";
}

export type BuyerProblems = Partial<Record<"name" | "phone" | "gstin", string>>;

export function buyerProblems(buyer: BuyerDraft): BuyerProblems {
  const problems: BuyerProblems = {};
  if (!buyer.name.trim()) problems.name = buyer.entity === "business" ? "Enter the business name." : "Enter the customer's name.";
  const phone = buyer.phone.replace(/[\s-]/g, "");
  if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) problems.phone = "Enter a phone number with 8 to 15 digits.";
  if (buyer.gstin.trim() && !GSTIN_PATTERN.test(buyer.gstin.trim().toUpperCase())) problems.gstin = "Enter the 15-character GSTIN, or leave it blank.";
  return problems;
}

export function customerInput(buyer: BuyerDraft): CustomerInput {
  const gstin = buyer.gstin.trim().toUpperCase();
  return {
    name: buyer.name.trim(),
    entity: buyer.entity,
    kind: gstin ? "registered" : "unregistered",
    gstin,
    phone: buyer.phone.replace(/[\s-]/g, ""),
    address: buyer.address.trim(),
    state: buyer.state || stateFromGstin(gstin),
  };
}

export function buyerChanged(buyer: BuyerDraft, saved: Customer | undefined): boolean {
  if (!saved) return true;
  const next = customerInput(buyer);
  return (
    next.name !== saved.name ||
    next.entity !== saved.entity ||
    next.gstin !== saved.gstin ||
    next.phone !== saved.phone ||
    next.address !== saved.address ||
    next.state !== saved.state
  );
}

/* ---------------- totals and the document ---------------- */

export function placeOf(business: Business, draft: BillDraft): string {
  return draft.placeOfSupply || draft.buyer.state || business.state;
}

export function billFor(business: Business, draft: BillDraft, lines: LineInput[] = draft.lines): CalculatedBill {
  const interstate = business.gstRegistered && isInterstate(business.state, placeOf(business, draft));
  return calculateBill(lines, interstate, business.gstRegistered, business.roundOff);
}

export function paymentOf(draft: BillDraft): { payment: Payment; amountPaid: number | null } {
  if (draft.received === "none") return { payment: "unpaid", amountPaid: 0 };
  if (draft.received === "full") return { payment: draft.method, amountPaid: null };
  return { payment: draft.method, amountPaid: number(draft.amountPaid) };
}

export function documentFor(business: Business, draft: BillDraft, bill: CalculatedBill): InvoiceDocument {
  const { payment, amountPaid } = paymentOf(draft);
  const paid = amountPaid == null ? bill.payable : Number.isFinite(amountPaid) ? amountPaid : 0;
  return {
    seller: sellerSnapshot(business),
    logo: business.logo,
    number: invoiceNumber(business.invoicePrefix, business.nextNumber),
    issuedOn: draft.issuedOn,
    dueOn: draft.dueOn,
    poNumber: draft.poNumber.trim(),
    placeOfSupply: placeOf(business, draft),
    paymentTerms: draft.paymentTerms,
    buyer: {
      name: draft.buyer.name.trim(),
      gstin: draft.buyer.gstin.trim().toUpperCase(),
      address: draft.buyer.address.trim(),
      state: draft.buyer.state,
      phone: draft.buyer.phone.trim(),
    },
    bill,
    payment,
    amountPaid: payment === "unpaid" ? 0 : paid,
    notes: draft.notes.trim(),
    terms: draft.terms.trim(),
    cancelled: false,
  };
}

export function invoiceInput(business: Business, draft: BillDraft, customerId: string | null, bill: CalculatedBill): InvoiceInput {
  const buyer = customerInput(draft.buyer);
  const { payment, amountPaid } = paymentOf(draft);
  return {
    clientRef: draft.ref,
    issuedOn: draft.issuedOn,
    dueOn: draft.dueOn,
    customerId,
    customerName: buyer.name,
    customerKind: buyer.kind,
    customerGstin: buyer.gstin,
    customerState: buyer.state,
    customerAddress: buyer.address,
    customerPhone: buyer.phone,
    placeOfSupply: draft.placeOfSupply,
    paymentTerms: draft.paymentTerms,
    poNumber: draft.poNumber.trim(),
    notes: draft.notes.trim(),
    terms: draft.terms.trim(),
    payment,
    amountPaid,
    lines: draft.lines.map(({ key: _key, ...line }) => line),
    expectedPayable: bill.payable,
  };
}

export function detailProblems(draft: BillDraft, bill: CalculatedBill): string | null {
  if (draft.dueOn && draft.dueOn < draft.issuedOn) return "The due date cannot be before the bill date.";
  if (draft.received === "part") {
    const paid = number(draft.amountPaid);
    if (!Number.isFinite(paid) || paid <= 0) return "Enter how much was paid.";
    if (Math.round(paid * 100) > Math.round(bill.payable * 100)) return "The amount paid is more than the total.";
  }
  return null;
}

/** What the template looks like with one line on it: the first saved item if there is one. */
export function sampleDocument(business: BusinessInput & { nextNumber?: number }, item?: Item): InvoiceDocument {
  const line: LineInput = {
    name: item?.name ?? "Sample item",
    description: item?.description ?? "",
    quantity: 1,
    unitPrice: item?.price ?? 100,
    gstRate: business.gstRegistered ? (item?.gstRate ?? business.defaultGstRate) : 0,
    priceMode: item?.priceMode ?? business.defaultPriceMode,
    discount: 0,
    supply: business.gstRegistered ? (item?.supply ?? "taxable") : "non-gst",
    hsn: item?.hsn ?? "",
    unit: item?.unit ?? "",
    packs: null,
    packUnit: "",
    itemId: null,
  };
  return {
    seller: sellerSnapshot(business),
    logo: business.logo,
    number: invoiceNumber(business.invoicePrefix || "INV", business.nextNumber ?? 1),
    issuedOn: indiaToday(),
    dueOn: null,
    poNumber: "",
    placeOfSupply: business.state,
    paymentTerms: "",
    buyer: { name: "Sample customer", gstin: "", address: "", state: business.state, phone: "" },
    bill: calculateBill([line], false, business.gstRegistered, business.roundOff),
    payment: "unpaid",
    amountPaid: 0,
    notes: "",
    terms: business.terms,
    cancelled: false,
  };
}

/* ---------------- keeping the draft ---------------- */

const key = (businessId: string) => `salaryapp.billDraft.${businessId}`;

export async function loadDraft(businessId: string): Promise<BillDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BillDraft;
    return parsed.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDraft(businessId: string, draft: BillDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(key(businessId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    // A draft that cannot be kept should not stop the bill.
  }
}

export async function clearDraft(businessId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(businessId));
  } catch {
    // Nothing to clear.
  }
}

/** Worth offering to continue: someone has been chosen or something added. */
export function draftHasWork(draft: BillDraft | null): draft is BillDraft {
  return Boolean(draft && (draft.buyer.name.trim() || draft.lines.length > 0 || draft.item?.name.trim()));
}
