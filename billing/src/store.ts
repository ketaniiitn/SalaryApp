import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { balanceDue, calculateBill, invoiceNumber, isInterstate, monthSpan, sellerSnapshot } from "./gst";
import type {
  Business,
  BusinessInput,
  CalculatedLine,
  Customer,
  CustomerInput,
  Invoice,
  InvoiceInput,
  Item,
  ItemInput,
  LineInput,
  MonthSummary,
  Payment,
  PriceMode,
  SellerSnapshot,
  Supply,
} from "./types";

export type InvoiceFilter = { query: string; from?: string; to?: string };

/**
 * Why an invoice was not saved.
 * "different": the clientRef was already used for a saved invoice whose details differ from this request.
 */
export type InvoiceRefusal = "missing" | "empty" | "customer" | "changed" | "overpaid" | "different";

export type BillingStore = {
  kind: "memory" | "supabase";
  listBusinesses(ownerId: string): Promise<Business[]>;
  getBusiness(ownerId: string, id: string): Promise<Business | null>;
  getBusinessForOrganisation(ownerId: string, organisationId: string): Promise<Business | null>;
  createBusiness(ownerId: string, organisationId: string, input: BusinessInput): Promise<Business>;
  updateBusiness(ownerId: string, id: string, input: BusinessInput): Promise<Business | null>;
  listItems(ownerId: string, businessId: string): Promise<Item[] | null>;
  createItem(ownerId: string, businessId: string, input: ItemInput): Promise<Item | null>;
  updateItem(ownerId: string, businessId: string, itemId: string, input: ItemInput): Promise<Item | null>;
  deleteItem(ownerId: string, businessId: string, itemId: string): Promise<boolean>;
  listCustomers(ownerId: string, businessId: string): Promise<Customer[] | null>;
  createCustomer(ownerId: string, businessId: string, input: CustomerInput): Promise<Customer | null>;
  updateCustomer(ownerId: string, businessId: string, customerId: string, input: CustomerInput): Promise<Customer | null>;
  listInvoices(ownerId: string, businessId: string, filter: InvoiceFilter): Promise<Invoice[] | null>;
  getInvoice(ownerId: string, businessId: string, invoiceId: string): Promise<Invoice | null>;
  createInvoice(ownerId: string, businessId: string, input: InvoiceInput): Promise<Invoice | InvoiceRefusal>;
  /** amountPaid null means paid in full, unless payment is "unpaid". */
  setPayment(ownerId: string, businessId: string, invoiceId: string, payment: Payment, amountPaid: number | null): Promise<Invoice | null | "overpaid">;
  cancelInvoice(ownerId: string, businessId: string, invoiceId: string): Promise<Invoice | null>;
  monthSummary(ownerId: string, businessId: string, month: string): Promise<MonthSummary | null>;
};

type SavedInvoice = Invoice;

function memoryStore(): BillingStore {
  const businesses: Business[] = [];
  const items: Item[] = [];
  const customers: Customer[] = [];
  const invoices: SavedInvoice[] = [];

  function owned(ownerId: string, id: string): Business | null {
    return businesses.find((business) => business.id === id && business.ownerId === ownerId) ?? null;
  }

  return {
    kind: "memory",
    async listBusinesses(ownerId) {
      return businesses.filter((business) => business.ownerId === ownerId).sort(byNewest);
    },
    async getBusiness(ownerId, id) {
      return owned(ownerId, id);
    },
    async getBusinessForOrganisation(ownerId, organisationId) {
      return businesses.find((business) => business.ownerId === ownerId && business.organisationId === organisationId) ?? null;
    },
    async createBusiness(ownerId, organisationId, input) {
      const business: Business = {
        ...input,
        id: randomUUID(),
        ownerId,
        organisationId,
        nextNumber: 1,
        createdAt: new Date().toISOString(),
      };
      businesses.push(business);
      return business;
    },
    async updateBusiness(ownerId, id, input) {
      const index = businesses.findIndex((business) => business.id === id && business.ownerId === ownerId);
      if (index < 0) return null;
      businesses[index] = { ...businesses[index], ...input };
      return businesses[index];
    },
    async listItems(ownerId, businessId) {
      if (!owned(ownerId, businessId)) return null;
      return items.filter((item) => item.businessId === businessId).sort(byNewest);
    },
    async createItem(ownerId, businessId, input) {
      if (!owned(ownerId, businessId)) return null;
      const item: Item = { ...input, id: randomUUID(), businessId, createdAt: new Date().toISOString() };
      items.push(item);
      return item;
    },
    async updateItem(ownerId, businessId, itemId, input) {
      if (!owned(ownerId, businessId)) return null;
      const index = items.findIndex((item) => item.id === itemId && item.businessId === businessId);
      if (index < 0) return null;
      items[index] = { ...items[index], ...input };
      return items[index];
    },
    async deleteItem(ownerId, businessId, itemId) {
      if (!owned(ownerId, businessId)) return false;
      const index = items.findIndex((item) => item.id === itemId && item.businessId === businessId);
      if (index < 0) return false;
      items.splice(index, 1);
      return true;
    },
    async listCustomers(ownerId, businessId) {
      if (!owned(ownerId, businessId)) return null;
      return customers.filter((customer) => customer.businessId === businessId).sort((a, b) => a.name.localeCompare(b.name));
    },
    async createCustomer(ownerId, businessId, input) {
      if (!owned(ownerId, businessId)) return null;
      const customer: Customer = { ...input, id: randomUUID(), businessId, createdAt: new Date().toISOString() };
      customers.push(customer);
      return customer;
    },
    async updateCustomer(ownerId, businessId, customerId, input) {
      if (!owned(ownerId, businessId)) return null;
      const index = customers.findIndex((customer) => customer.id === customerId && customer.businessId === businessId);
      if (index < 0) return null;
      customers[index] = { ...customers[index], ...input };
      return customers[index];
    },
    async listInvoices(ownerId, businessId, filter) {
      if (!owned(ownerId, businessId)) return null;
      return matching(
        invoices.filter((invoice) => invoice.businessId === businessId),
        filter,
      ).sort(byNewest);
    },
    async getInvoice(ownerId, businessId, invoiceId) {
      if (!owned(ownerId, businessId)) return null;
      return invoices.find((invoice) => invoice.id === invoiceId && invoice.businessId === businessId) ?? null;
    },
    async createInvoice(ownerId, businessId, input) {
      const business = owned(ownerId, businessId);
      if (!business) return "missing";
      if (input.lines.length === 0) return "empty";
      if (input.customerId && !customers.some((customer) => customer.id === input.customerId && customer.businessId === businessId)) {
        return "customer";
      }
      const repeat = input.clientRef ? invoices.find((invoice) => invoice.businessId === businessId && invoice.clientRef === input.clientRef) : null;
      if (repeat) return sameDraft(repeat, input) ? repeat : "different";
      const invoice = prepareInvoice(business, input);
      if (typeof invoice === "string") return invoice;
      let sequence = business.nextNumber;
      while (invoices.some((saved) => saved.businessId === businessId && saved.number === invoiceNumber(business.invoicePrefix, sequence))) sequence += 1;
      invoice.number = invoiceNumber(business.invoicePrefix, sequence);
      business.nextNumber = sequence + 1;
      invoices.push(invoice);
      return invoice;
    },
    async setPayment(ownerId, businessId, invoiceId, payment, amountPaid) {
      const invoice = invoices.find((item) => item.id === invoiceId && item.businessId === businessId);
      if (!invoice || !owned(ownerId, businessId) || invoice.status !== "issued") return null;
      const paid = paidAmount(payment, amountPaid, invoice.payable);
      if (paid === "overpaid") return paid;
      invoice.payment = payment;
      invoice.amountPaid = paid;
      return invoice;
    },
    async cancelInvoice(ownerId, businessId, invoiceId) {
      const invoice = invoices.find((item) => item.id === invoiceId && item.businessId === businessId);
      if (!invoice || !owned(ownerId, businessId) || invoice.status !== "issued") return null;
      invoice.status = "cancelled";
      return invoice;
    },
    async monthSummary(ownerId, businessId, month) {
      if (!owned(ownerId, businessId)) return null;
      return summarise(
        month,
        invoices.filter((invoice) => invoice.businessId === businessId && invoice.status === "issued" && invoice.issuedOn.startsWith(month)),
      );
    },
  };
}

/** Calculates the bill on the server and checks it against what the phone showed. The number is filled in when it is given out. */
function prepareInvoice(business: Business, input: InvoiceInput): Invoice | "changed" | "overpaid" {
  const placeOfSupply = input.placeOfSupply || input.customerState || business.state;
  const interstate = business.gstRegistered && isInterstate(business.state, placeOfSupply);
  const bill = calculateBill(input.lines, interstate, business.gstRegistered, business.roundOff);
  if (input.expectedPayable != null && Math.round(input.expectedPayable * 100) !== Math.round(bill.payable * 100)) return "changed";
  const paid = paidAmount(input.payment, input.amountPaid, bill.payable);
  if (paid === "overpaid") return paid;
  return {
    ...bill,
    id: randomUUID(),
    businessId: business.id,
    clientRef: input.clientRef,
    number: "",
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    customerId: input.customerId,
    customerName: input.customerName,
    customerKind: input.customerKind,
    customerGstin: input.customerKind === "registered" ? input.customerGstin : "",
    customerState: input.customerState,
    customerAddress: input.customerAddress,
    customerPhone: input.customerPhone,
    placeOfSupply,
    paymentTerms: input.paymentTerms,
    poNumber: input.poNumber,
    notes: input.notes,
    terms: input.terms,
    payment: input.payment,
    amountPaid: paid,
    status: "issued",
    seller: sellerSnapshot(business),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Whether a save that reuses a clientRef is a retry of the saved invoice, not a different bill.
 * A retry resends the same draft, so the customer, the lines, and the total the phone showed match.
 * Business settings may have changed since the first save, so this compares the request with what
 * was stored rather than recalculating the bill.
 */
function sameDraft(saved: Invoice, input: InvoiceInput): boolean {
  const paise = (value: number) => Math.round(value * 100);
  if (input.expectedPayable != null && paise(input.expectedPayable) !== paise(saved.payable)) return false;
  if (input.customerName.trim() !== saved.customerName.trim()) return false;
  return lineFingerprint(input.lines, saved.seller?.gstRegistered ?? null) === lineFingerprint(saved.lines, saved.seller?.gstRegistered ?? null);
}

/**
 * A stable string for the parts of the lines that decide the amounts. Saved lines carry the rate and supply
 * after calculateLine (rate 0 unless taxable, supply "non-gst" for an unregistered seller), so both sides are
 * reduced the same way before comparing. gstRegistered null means the seller was not recorded (old invoices).
 */
function lineFingerprint(lines: LineInput[], gstRegistered: boolean | null): string {
  return JSON.stringify(
    lines.map((line) => {
      const supply = gstRegistered === false ? "non-gst" : line.supply;
      return [
        line.name.trim(),
        Math.round(line.quantity * 1000),
        Math.round(line.unitPrice * 100),
        Math.round(line.discount * 100),
        line.priceMode,
        // Without the seller snapshot the stored rate may have been zeroed for an unregistered seller,
        // so only the expected total and the other fields decide.
        gstRegistered === null ? null : supply,
        gstRegistered === null ? null : supply === "taxable" ? line.gstRate : 0,
      ];
    }),
  );
}

function paidAmount(payment: Payment, amountPaid: number | null, payable: number): number | "overpaid" {
  if (payment === "unpaid") return 0;
  const paid = amountPaid ?? payable;
  if (Math.round(paid * 100) > Math.round(payable * 100)) return "overpaid";
  return paid;
}

function matching(invoices: Invoice[], filter: InvoiceFilter): Invoice[] {
  const needle = filter.query.trim().toLowerCase();
  return invoices.filter((invoice) => {
    if (filter.from && invoice.issuedOn < filter.from) return false;
    if (filter.to && invoice.issuedOn > filter.to) return false;
    if (!needle) return true;
    return (
      invoice.number.toLowerCase().includes(needle) ||
      invoice.customerName.toLowerCase().includes(needle) ||
      invoice.customerPhone.includes(needle) ||
      invoice.issuedOn.includes(needle)
    );
  });
}

/**
 * The PostgREST `or=(...)` filter for an invoice search, the database side of matching():
 * number, customer name and customer phone contain the text (ilike), or the bill date is in it.
 *
 * Escaping: the pattern goes inside a double-quoted PostgREST value, so `,` `.` `:` `(` `)` are literal there.
 * Characters that are special to LIKE or to the quoting (`%` `_` `*` `\` `"`) are replaced by `_`, LIKE's
 * any-one-character wildcard. That never drops a real match, only lets in a few extra rows, and matching()
 * runs on the result afterwards with the exact text.
 *
 * issued_on is a date column, which ilike cannot search. A search for YYYY, YYYY-MM or YYYY-MM-DD becomes a
 * date range. Other pieces of a date (such as "11-24") are not searched in the database.
 * Returns null when there is nothing to search for.
 */
export function invoiceSearchFilter(query: string): string | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const pattern = `"%${needle.replace(/[%_*\\"]/g, "_")}%"`;
  const parts = [`number.ilike.${pattern}`, `customer_name.ilike.${pattern}`, `customer_phone.ilike.${pattern}`];
  const span = dateSpan(needle);
  if (span) parts.push(`and(issued_on.gte.${span.start},issued_on.lte.${span.end})`);
  return parts.join(",");
}

/** The dates a search of YYYY, YYYY-MM or YYYY-MM-DD covers, or null when it is not one of those. */
function dateSpan(needle: string): { start: string; end: string } | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(needle);
  if (!match) return null;
  const [, year, month, day] = match;
  if (Number(year) < 1000) return null;
  if (!month) return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (Number(month) < 1 || Number(month) > 12) return null;
  const span = monthSpan(`${year}-${month}`);
  if (!day) return span;
  if (Number(day) < 1 || `${year}-${month}-${day}` > span.end) return null;
  return { start: `${year}-${month}-${day}`, end: `${year}-${month}-${day}` };
}

function summarise(month: string, invoices: Invoice[]): MonthSummary {
  const paise = (value: number) => Math.round(value * 100);
  const add = (key: "taxableValue" | "tax" | "payable") =>
    invoices.reduce((total, invoice) => total + paise(invoice[key]), 0) / 100;
  const outstanding = invoices.reduce((total, invoice) => total + paise(balanceDue(invoice)), 0) / 100;
  return { month, count: invoices.length, taxable: add("taxableValue"), tax: add("tax"), total: add("payable"), outstanding };
}

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

type BusinessRow = {
  id: string;
  owner_id: string;
  organisation_id: string | null;
  name: string;
  category: string;
  address: string;
  state: string;
  phone: string;
  gst_registered: boolean;
  gstin: string | null;
  invoice_prefix: string;
  next_number: number;
  default_price_mode: PriceMode;
  default_gst_rate: number | string;
  email?: string | null;
  logo?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  terms?: string | null;
  footer?: string | null;
  layout?: "standard" | "compact" | null;
  show_hsn?: boolean | null;
  round_off?: boolean | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  price: number | string;
  hsn: string;
  gst_rate: number | string;
  price_mode: PriceMode;
  unit: string;
  supply: Supply;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  business_id: string;
  number: string;
  issued_on: string;
  customer_id: string | null;
  customer_name: string;
  customer_kind: Customer["kind"] | null;
  customer_gstin: string;
  customer_state: string;
  customer_address: string | null;
  customer_phone?: string | null;
  due_on?: string | null;
  payment_terms?: string | null;
  po_number?: string | null;
  place_of_supply?: string | null;
  notes?: string | null;
  terms?: string | null;
  round_off?: number | string | null;
  payable?: number | string | null;
  amount_paid?: number | string | null;
  seller?: SellerSnapshot | string | null;
  client_ref?: string | null;
  interstate: boolean;
  payment: Payment;
  status: "issued" | "cancelled";
  lines: LineInput[] | string;
  taxable_value: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  tax: number | string;
  total: number | string;
  created_at: string;
};

function fromBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organisationId: row.organisation_id ?? "",
    name: row.name,
    category: row.category,
    address: row.address,
    state: row.state,
    phone: row.phone,
    gstRegistered: row.gst_registered,
    gstin: row.gstin ?? "",
    invoicePrefix: row.invoice_prefix,
    nextNumber: row.next_number,
    defaultPriceMode: row.default_price_mode,
    defaultGstRate: Number(row.default_gst_rate),
    email: row.email ?? "",
    logo: row.logo ?? "",
    bankName: row.bank_name ?? "",
    bankAccount: row.bank_account ?? "",
    bankIfsc: row.bank_ifsc ?? "",
    upiId: row.upi_id ?? "",
    terms: row.terms ?? "",
    footer: row.footer ?? "",
    layout: row.layout ?? "standard",
    showHsn: row.show_hsn ?? true,
    roundOff: row.round_off ?? false,
    createdAt: row.created_at,
  };
}

type CustomerRow = {
  id: string;
  business_id: string;
  name: string;
  kind: Customer["kind"];
  entity?: Customer["entity"] | null;
  gstin: string | null;
  phone?: string | null;
  address: string | null;
  state: string | null;
  created_at: string;
};

function fromCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    entity: row.entity ?? "business",
    kind: row.kind,
    gstin: row.gstin ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    state: row.state ?? "",
    createdAt: row.created_at,
  };
}

function customerColumns(input: CustomerInput) {
  return {
    name: input.name,
    entity: input.entity,
    kind: input.kind,
    gstin: input.kind === "registered" ? input.gstin : "",
    phone: input.phone,
    address: input.address,
    state: input.state,
  };
}

function fromItem(row: ItemRow): Item {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    hsn: row.hsn,
    gstRate: Number(row.gst_rate),
    priceMode: row.price_mode,
    unit: row.unit,
    supply: row.supply,
    createdAt: row.created_at,
  };
}

function fromInvoice(row: InvoiceRow): Invoice {
  const raw = typeof row.lines === "string" ? (JSON.parse(row.lines) as CalculatedLine[]) : (row.lines as CalculatedLine[]);
  const lines = raw.map((line) => ({
    ...line,
    description: line.description ?? "",
    unit: line.unit ?? "",
    packs: line.packs ?? null,
    packUnit: line.packUnit ?? "",
    hsn: line.hsn ?? "",
    discount: line.discount ?? 0,
    itemId: line.itemId ?? null,
  }));
  const total = Number(row.total);
  const payable = row.payable == null ? total : Number(row.payable);
  const paise = (value: number) => Math.round(value * 100);
  const seller = typeof row.seller === "string" ? (JSON.parse(row.seller) as SellerSnapshot) : (row.seller ?? null);
  return {
    id: row.id,
    businessId: row.business_id,
    clientRef: row.client_ref ?? null,
    number: row.number,
    issuedOn: row.issued_on,
    dueOn: row.due_on ?? null,
    customerId: row.customer_id ?? null,
    customerName: row.customer_name,
    customerKind: row.customer_kind ?? "unregistered",
    customerGstin: row.customer_gstin,
    customerState: row.customer_state,
    customerAddress: row.customer_address ?? "",
    customerPhone: row.customer_phone ?? "",
    placeOfSupply: row.place_of_supply ?? "",
    paymentTerms: row.payment_terms ?? "",
    poNumber: row.po_number ?? "",
    notes: row.notes ?? "",
    terms: row.terms ?? "",
    interstate: row.interstate,
    payment: row.payment,
    amountPaid: row.amount_paid == null ? (row.payment === "unpaid" ? 0 : payable) : Number(row.amount_paid),
    status: row.status,
    seller,
    lines,
    subtotal: lines.reduce((sum, line) => sum + paise(line.unitPrice * line.quantity), 0) / 100,
    discount: lines.reduce((sum, line) => sum + paise(line.discount), 0) / 100,
    taxableValue: Number(row.taxable_value),
    cgst: Number(row.cgst),
    sgst: Number(row.sgst),
    igst: Number(row.igst),
    tax: Number(row.tax),
    total,
    roundOff: row.round_off == null ? 0 : Number(row.round_off),
    payable,
    createdAt: row.created_at,
  };
}

function businessColumns(input: BusinessInput) {
  return {
    name: input.name,
    category: input.category,
    address: input.address,
    state: input.state,
    phone: input.phone,
    gst_registered: input.gstRegistered,
    gstin: input.gstRegistered ? input.gstin : null,
    invoice_prefix: input.invoicePrefix,
    default_price_mode: input.defaultPriceMode,
    default_gst_rate: input.defaultGstRate,
    email: input.email,
    logo: input.logo,
    bank_name: input.bankName,
    bank_account: input.bankAccount,
    bank_ifsc: input.bankIfsc,
    upi_id: input.upiId,
    terms: input.terms,
    footer: input.footer,
    layout: input.layout,
    show_hsn: input.showHsn,
    round_off: input.roundOff,
  };
}

function itemColumns(input: ItemInput) {
  return {
    name: input.name,
    description: input.description,
    price: input.price,
    hsn: input.hsn,
    gst_rate: input.gstRate,
    price_mode: input.priceMode,
    unit: input.unit,
    supply: input.supply,
  };
}

function supabaseStore(client: SupabaseClient): BillingStore {
  async function owned(ownerId: string, id: string): Promise<Business | null> {
    const { data, error } = await client
      .from("billing_businesses")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromBusiness(data as BusinessRow) : null;
  }

  return {
    kind: "supabase",
    async listBusinesses(ownerId) {
      const { data, error } = await client
        .from("billing_businesses")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as BusinessRow[]).map(fromBusiness);
    },
    async getBusiness(ownerId, id) {
      return owned(ownerId, id);
    },
    async getBusinessForOrganisation(ownerId, organisationId) {
      const { data, error } = await client
        .from("billing_businesses")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("organisation_id", organisationId)
        .maybeSingle();
      if (error) throw error;
      return data ? fromBusiness(data as BusinessRow) : null;
    },
    async createBusiness(ownerId, organisationId, input) {
      const { data, error } = await client
        .from("billing_businesses")
        .insert({ ...businessColumns(input), owner_id: ownerId, organisation_id: organisationId })
        .select("*")
        .single();
      if (error) throw error;
      return fromBusiness(data as BusinessRow);
    },
    async updateBusiness(ownerId, id, input) {
      const { data, error } = await client
        .from("billing_businesses")
        .update(businessColumns(input))
        .eq("id", id)
        .eq("owner_id", ownerId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromBusiness(data as BusinessRow) : null;
    },
    async listItems(ownerId, businessId) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_items")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ItemRow[]).map(fromItem);
    },
    async createItem(ownerId, businessId, input) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_items")
        .insert({ ...itemColumns(input), business_id: businessId })
        .select("*")
        .single();
      if (error) throw error;
      return fromItem(data as ItemRow);
    },
    async updateItem(ownerId, businessId, itemId, input) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_items")
        .update(itemColumns(input))
        .eq("id", itemId)
        .eq("business_id", businessId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromItem(data as ItemRow) : null;
    },
    async deleteItem(ownerId, businessId, itemId) {
      if (!(await owned(ownerId, businessId))) return false;
      const { data, error } = await client
        .from("billing_items")
        .delete()
        .eq("id", itemId)
        .eq("business_id", businessId)
        .select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async listCustomers(ownerId, businessId) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client.from("billing_customers").select("*").eq("business_id", businessId).order("name");
      if (error) throw error;
      return ((data ?? []) as CustomerRow[]).map(fromCustomer);
    },
    async createCustomer(ownerId, businessId, input) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_customers")
        .insert({ ...customerColumns(input), business_id: businessId })
        .select("*")
        .single();
      if (error) throw error;
      return fromCustomer(data as CustomerRow);
    },
    async updateCustomer(ownerId, businessId, customerId, input) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_customers")
        .update(customerColumns(input))
        .eq("id", customerId)
        .eq("business_id", businessId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromCustomer(data as CustomerRow) : null;
    },
    async listInvoices(ownerId, businessId, filter) {
      if (!(await owned(ownerId, businessId))) return null;
      let query = client.from("billing_invoices").select("*").eq("business_id", businessId);
      if (filter.from) query = query.gte("issued_on", filter.from);
      if (filter.to) query = query.lte("issued_on", filter.to);
      // Search in the database, so the newest 500 are the newest 500 that match, not the newest 500 overall.
      const search = invoiceSearchFilter(filter.query);
      if (search) query = query.or(search);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      // The database filter can be wider than matching() (see invoiceSearchFilter), so this keeps the exact rule.
      return matching(((data ?? []) as InvoiceRow[]).map(fromInvoice), { query: filter.query });
    },
    async getInvoice(ownerId, businessId, invoiceId) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data ? fromInvoice(data as InvoiceRow) : null;
    },
    async createInvoice(ownerId, businessId, input) {
      const business = await owned(ownerId, businessId);
      if (!business) return "missing";
      if (input.lines.length === 0) return "empty";
      if (input.customerId) {
        const { data, error } = await client
          .from("billing_customers")
          .select("id")
          .eq("id", input.customerId)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return "customer";
      }
      // A retried save is answered from the saved invoice before the bill is recalculated,
      // as in the memory store, so a retry is not refused as "changed" or "overpaid".
      if (input.clientRef) {
        const { data: existing, error: lookupError } = await client
          .from("billing_invoices")
          .select("*")
          .eq("business_id", businessId)
          .eq("client_ref", input.clientRef)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existing) {
          const repeat = fromInvoice(existing as InvoiceRow);
          return sameDraft(repeat, input) ? repeat : "different";
        }
      }
      const invoice = prepareInvoice(business, input);
      if (typeof invoice === "string") return invoice;
      const { data, error } = await client.rpc("billing_create_invoice", {
        p_owner_id: ownerId,
        p_business_id: businessId,
        p_invoice: invoiceRow(invoice),
      });
      if (error) throw error;
      const saved = fromInvoice(data as InvoiceRow);
      // Two saves with the same clientRef can both miss the lookup above. The RPC then returns the row the
      // other one inserted (its id is not ours), so compare it as well.
      if (saved.id !== invoice.id && !sameDraft(saved, input)) return "different";
      return saved;
    },
    async setPayment(ownerId, businessId, invoiceId, payment, amountPaid) {
      if (!(await owned(ownerId, businessId))) return null;
      const current = await this.getInvoice(ownerId, businessId, invoiceId);
      if (!current || current.status !== "issued") return null;
      const paid = paidAmount(payment, amountPaid, current.payable);
      if (paid === "overpaid") return paid;
      const { data, error } = await client
        .from("billing_invoices")
        .update({ payment, amount_paid: paid })
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .eq("status", "issued")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromInvoice(data as InvoiceRow) : null;
    },
    async cancelInvoice(ownerId, businessId, invoiceId) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_invoices")
        .update({ status: "cancelled" })
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .eq("status", "issued")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromInvoice(data as InvoiceRow) : null;
    },
    async monthSummary(ownerId, businessId, month) {
      if (!(await owned(ownerId, businessId))) return null;
      const { data, error } = await client
        .from("billing_invoices")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "issued")
        .gte("issued_on", monthSpan(month).start)
        .lte("issued_on", monthSpan(month).end);
      if (error) throw error;
      return summarise(month, ((data ?? []) as InvoiceRow[]).map(fromInvoice));
    },
  };
}

function invoiceRow(invoice: Invoice) {
  return {
    id: invoice.id,
    business_id: invoice.businessId,
    number: invoice.number,
    issued_on: invoice.issuedOn,
    due_on: invoice.dueOn,
    customer_id: invoice.customerId,
    customer_name: invoice.customerName,
    customer_kind: invoice.customerKind,
    customer_gstin: invoice.customerGstin,
    customer_state: invoice.customerState,
    customer_address: invoice.customerAddress,
    customer_phone: invoice.customerPhone,
    place_of_supply: invoice.placeOfSupply,
    payment_terms: invoice.paymentTerms,
    po_number: invoice.poNumber,
    notes: invoice.notes,
    terms: invoice.terms,
    interstate: invoice.interstate,
    payment: invoice.payment,
    amount_paid: invoice.amountPaid,
    status: invoice.status,
    lines: invoice.lines,
    taxable_value: invoice.taxableValue,
    cgst: invoice.cgst,
    sgst: invoice.sgst,
    igst: invoice.igst,
    tax: invoice.tax,
    total: invoice.total,
    round_off: invoice.roundOff,
    payable: invoice.payable,
    seller: invoice.seller,
    client_ref: invoice.clientRef,
  };
}

export function createBillingStore(): BillingStore {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return memoryStore();
  return supabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}
