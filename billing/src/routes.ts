import express from "express";
import { z } from "zod";
import { indiaMonth, indiaToday } from "./gst";
import { isIndianState, stateFromGstin } from "./states";
import type { BillingStore } from "./store";
import type { CustomerInput } from "./types";

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a 15-character GSTIN.");

const money = z
  .number({ required_error: "Enter the price.", invalid_type_error: "Enter the price." })
  .min(0, "The price cannot be negative.")
  .max(99999999.99, "That amount is too large.")
  .refine(twoDecimals, "Use at most two decimal places.");

const rate = z
  .number({ required_error: "Enter the GST rate.", invalid_type_error: "Enter the GST rate." })
  .min(0, "GST rate cannot be negative.")
  .max(100, "GST rate cannot be more than 100.")
  .refine(twoDecimals, "Use at most two decimal places.");

const priceMode = z.enum(["exclusive", "inclusive"], {
  required_error: "Choose whether the price includes GST.",
  invalid_type_error: "Choose whether the price includes GST.",
});

const supply = z.enum(["taxable", "exempt", "nil", "non-gst"]);
const payment = z.enum(["cash", "upi", "card", "bank", "unpaid"]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-23.");

const text = (max: number, message: string) => z.string().trim().max(max, message).default("");

/** A small PNG, JPEG or WebP as a data URL. About 300 KB at most. */
const logo = z
  .string()
  .max(400000, "Choose a smaller logo.")
  .refine((value) => value === "" || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value), "The logo must be a PNG or JPEG image.")
  .default("");

const businessSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the business name.").max(80, "Business name is too long."),
    category: z.string().trim().max(80, "Category is too long."),
    address: z.string().trim().max(200, "Address is too long."),
    state: z.string().trim().refine(isIndianState, "Choose the state."),
    phone: z.string().trim().max(20, "Phone number is too long."),
    gstRegistered: z.boolean({ required_error: "Say whether this business has GST.", invalid_type_error: "Say whether this business has GST." }),
    gstin: z.string().trim().toUpperCase(),
    invoicePrefix: z
      .string()
      .trim()
      .min(1, "Enter an invoice prefix.")
      .max(8, "Invoice prefix is too long.")
      .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers for the invoice prefix."),
    defaultPriceMode: priceMode,
    defaultGstRate: rate,
    email: z
      .string()
      .trim()
      .max(120, "Email is too long.")
      .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter an email like name@shop.in.")
      .default(""),
    logo,
    bankName: text(80, "Bank name is too long."),
    bankAccount: z
      .string()
      .trim()
      .max(20, "Account number is too long.")
      .refine((value) => value === "" || /^[0-9]{6,20}$/.test(value), "Use only digits for the account number.")
      .default(""),
    bankIfsc: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value), "Enter an 11-character IFSC like SBIN0001234.")
      .default(""),
    upiId: z
      .string()
      .trim()
      .max(60, "UPI ID is too long.")
      .refine((value) => value === "" || /^[\w.-]+@[\w.-]+$/.test(value), "Enter a UPI ID like shop@upi.")
      .default(""),
    terms: text(1000, "Keep the terms under 1000 letters."),
    footer: text(160, "Keep the footer under 160 letters."),
    layout: z.enum(["standard", "compact"]).default("standard"),
    showHsn: z.boolean().default(true),
    roundOff: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (!value.gstRegistered) return;
    const parsed = gstin.safeParse(value.gstin);
    if (!parsed.success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? "Enter the GSTIN.", path: ["gstin"] });
    }
  });

const itemSchema = z.object({
  name: z.string().trim().min(1, "Enter the item name.").max(80, "Item name is too long."),
  description: text(160, "Keep the description under 160 letters."),
  price: money,
  hsn: z.string().trim().max(8, "HSN or SAC is too long."),
  gstRate: rate,
  priceMode: priceMode,
  unit: z.string().trim().max(16, "Unit is too long."),
  supply: supply,
});

const packs = z
  .number({ invalid_type_error: "Enter the number of bags." })
  .positive("Enter the number of bags.")
  .max(100000, "That many bags is too large.")
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6, "Use at most three decimal places.")
  .nullable();

const lineSchema = itemSchema
  .omit({ price: true })
  .extend({
    quantity: z
      .number({ required_error: "Enter the quantity.", invalid_type_error: "Enter the quantity." })
      .positive("Enter the quantity.")
      .max(100000, "Quantity is too large.")
      .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6, "Use at most three decimal places."),
    unitPrice: money,
    discount: money,
    packs,
    packUnit: z.string().trim().max(16, "The pack name is too long."),
    itemId: z.string().uuid().nullable(),
  })
  .refine((line) => line.discount <= line.unitPrice * line.quantity + 0.001, {
    message: "The discount cannot be more than the line amount.",
    path: ["discount"],
  });

const customerSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the customer name.").max(80, "Customer name is too long."),
    entity: z.enum(["business", "individual"]).default("business"),
    kind: z.enum(["registered", "unregistered"], {
      required_error: "Choose registered or unregistered.",
      invalid_type_error: "Choose registered or unregistered.",
    }),
    gstin: z.string().trim().toUpperCase(),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\+?[0-9 ]{8,16}$/.test(value), "Enter a phone number with 8 to 15 digits.")
      .default(""),
    address: z.string().trim().max(240, "Keep the address under 240 letters."),
    state: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.kind === "registered" && !gstin.safeParse(value.gstin).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the customer's 15-character GSTIN.", path: ["gstin"] });
    }
    if (value.state && !isIndianState(value.state)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose the customer's state, or leave it blank for your own state.", path: ["state"] });
    }
  });

const invoiceSchema = z
  .object({
    clientRef: z.string().uuid().nullable().default(null),
    issuedOn: isoDate.refine((value) => value <= indiaToday(), "The bill date cannot be in the future."),
    dueOn: isoDate.nullable().default(null),
    customerId: z.string().uuid().nullable(),
    customerName: z.string().trim().min(1, "Enter the customer name.").max(80, "Customer name is too long."),
    customerKind: z.enum(["registered", "unregistered"]),
    customerGstin: z.string().trim().toUpperCase(),
    customerState: z.string().trim(),
    customerAddress: z.string().trim().max(240, "Keep the address under 240 letters."),
    customerPhone: text(20, "Phone number is too long."),
    placeOfSupply: text(60, "Choose the place of supply."),
    paymentTerms: text(60, "Payment terms are too long."),
    poNumber: text(40, "PO number is too long."),
    notes: text(500, "Keep the notes under 500 letters."),
    terms: text(1000, "Keep the terms under 1000 letters."),
    payment: payment,
    amountPaid: money.nullable().default(null),
    lines: z.array(lineSchema).min(1, "Add at least one item.").max(40, "A bill can have up to 40 items."),
    expectedPayable: z.number().nullable().default(null),
  })
  .refine((value) => !value.dueOn || value.dueOn >= value.issuedOn, { message: "The due date cannot be before the bill date.", path: ["dueOn"] });

function twoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function createBillingRouter(options: {
  store: BillingStore;
  requireAdmin: express.RequestHandler;
  adminId: (res: express.Response) => string;
  ownsOrganisation: (ownerId: string, organisationId: string) => Promise<boolean>;
}): express.Router {
  const { store } = options;
  const router = express.Router();
  router.use(options.requireAdmin);

  router.get("/businesses", async (_req, res) => {
    try {
      res.json(await store.listBusinesses(options.adminId(res)));
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/organisations/:organisationId", async (req, res) => {
    try {
      const ownerId = options.adminId(res);
      if (!(await options.ownsOrganisation(ownerId, req.params.organisationId))) {
        return missing(res, "That organisation was not found.");
      }
      const business = await store.getBusinessForOrganisation(ownerId, req.params.organisationId);
      if (!business) return missing(res, "Billing is not set up for this workplace yet.");
      res.json(business);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/organisations/:organisationId", async (req, res) => {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const ownerId = options.adminId(res);
      if (!(await options.ownsOrganisation(ownerId, req.params.organisationId))) {
        return missing(res, "That organisation was not found.");
      }
      const existing = await store.getBusinessForOrganisation(ownerId, req.params.organisationId);
      if (existing) {
        res.json(existing);
        return;
      }
      res.status(201).json(await store.createBusiness(ownerId, req.params.organisationId, normaliseBusiness(parsed.data)));
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/businesses", async (req, res) => {
    const parsed = businessSchema.safeParse(req.body);
    const organisationId = z.string().uuid("Choose a workplace.").safeParse(req.body?.organisationId);
    if (!parsed.success) return fail(res, parsed.error);
    if (!organisationId.success) return fail(res, organisationId.error);
    try {
      const ownerId = options.adminId(res);
      if (!(await options.ownsOrganisation(ownerId, organisationId.data))) {
        return missing(res, "That organisation was not found.");
      }
      res.status(201).json(await store.createBusiness(ownerId, organisationId.data, normaliseBusiness(parsed.data)));
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id", async (req, res) => {
    try {
      const business = await store.getBusiness(options.adminId(res), req.params.id);
      if (!business) return missing(res, "That business was not found.");
      res.json(business);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.patch("/businesses/:id", async (req, res) => {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const business = await store.updateBusiness(options.adminId(res), req.params.id, normaliseBusiness(parsed.data));
      if (!business) return missing(res, "That business was not found.");
      res.json(business);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id/summary", async (req, res) => {
    const month = typeof req.query.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month) ? req.query.month : indiaMonth();
    try {
      const summary = await store.monthSummary(options.adminId(res), req.params.id, month);
      if (!summary) return missing(res, "That business was not found.");
      res.json(summary);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id/items", async (req, res) => {
    try {
      const items = await store.listItems(options.adminId(res), req.params.id);
      if (!items) return missing(res, "That business was not found.");
      res.json(items);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/businesses/:id/items", async (req, res) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const item = await store.createItem(options.adminId(res), req.params.id, parsed.data);
      if (!item) return missing(res, "That business was not found.");
      res.status(201).json(item);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.patch("/businesses/:id/items/:itemId", async (req, res) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const item = await store.updateItem(options.adminId(res), req.params.id, req.params.itemId, parsed.data);
      if (!item) return missing(res, "That item was not found.");
      res.json(item);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.delete("/businesses/:id/items/:itemId", async (req, res) => {
    try {
      const removed = await store.deleteItem(options.adminId(res), req.params.id, req.params.itemId);
      if (!removed) return missing(res, "That item was not found.");
      res.status(204).end();
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id/customers", async (req, res) => {
    try {
      const customers = await store.listCustomers(options.adminId(res), req.params.id);
      if (!customers) return missing(res, "That business was not found.");
      res.json(customers);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/businesses/:id/customers", async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const ownerId = options.adminId(res);
      const input = normaliseCustomer(parsed.data);
      const existing = await store.listCustomers(ownerId, req.params.id);
      if (!existing) return missing(res, "That business was not found.");
      const same = sameCustomer(existing, input);
      if (same) {
        res.json(await store.updateCustomer(ownerId, req.params.id, same.id, mergeCustomer(same, input)));
        return;
      }
      const customer = await store.createCustomer(ownerId, req.params.id, input);
      if (!customer) return missing(res, "That business was not found.");
      res.status(201).json(customer);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.patch("/businesses/:id/customers/:customerId", async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const customer = await store.updateCustomer(options.adminId(res), req.params.id, req.params.customerId, normaliseCustomer(parsed.data));
      if (!customer) return missing(res, "That customer was not found.");
      res.json(customer);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id/invoices", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const from = typeof req.query.from === "string" && isoDate.safeParse(req.query.from).success ? req.query.from : undefined;
    const to = typeof req.query.to === "string" && isoDate.safeParse(req.query.to).success ? req.query.to : undefined;
    try {
      const invoices = await store.listInvoices(options.adminId(res), req.params.id, { query, from, to });
      if (!invoices) return missing(res, "That business was not found.");
      res.json(invoices);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/businesses/:id/invoices", async (req, res) => {
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    if (parsed.data.customerKind === "registered" && !gstin.safeParse(parsed.data.customerGstin).success) {
      res.status(400).json({ error: "Enter the customer's 15-character GSTIN." });
      return;
    }
    if (parsed.data.customerState && !isIndianState(parsed.data.customerState)) {
      res.status(400).json({ error: "Choose the customer's state, or leave it blank for a sale in your own state." });
      return;
    }
    if (parsed.data.placeOfSupply && !isIndianState(parsed.data.placeOfSupply)) {
      res.status(400).json({ error: "Choose the place of supply from the list of states." });
      return;
    }
    try {
      const invoice = await store.createInvoice(options.adminId(res), req.params.id, {
        ...parsed.data,
        customerGstin: parsed.data.customerKind === "registered" ? parsed.data.customerGstin : "",
        customerState: parsed.data.customerState || stateFromGstin(parsed.data.customerGstin),
      });
      if (invoice === "missing") return missing(res, "That business was not found.");
      if (invoice === "customer") return missing(res, "That customer was not found.");
      if (invoice === "empty") {
        res.status(400).json({ error: "Add at least one item." });
        return;
      }
      if (invoice === "changed") {
        res.status(409).json({ error: "The total changed because the business settings were updated. Check the bill and generate it again." });
        return;
      }
      if (invoice === "overpaid") {
        res.status(400).json({ error: "The amount paid cannot be more than the bill total." });
        return;
      }
      if (invoice === "different") {
        res.status(409).json({ error: "This bill was already saved with different details. Open your bills to check it." });
        return;
      }
      res.status(201).json(invoice);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.get("/businesses/:id/invoices/:invoiceId", async (req, res) => {
    try {
      const invoice = await store.getInvoice(options.adminId(res), req.params.id, req.params.invoiceId);
      if (!invoice) return missing(res, "That bill was not found.");
      res.json(invoice);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.patch("/businesses/:id/invoices/:invoiceId", async (req, res) => {
    const parsed = z.object({ payment, amountPaid: money.nullable().default(null) }).safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error);
    try {
      const invoice = await store.setPayment(options.adminId(res), req.params.id, req.params.invoiceId, parsed.data.payment, parsed.data.amountPaid);
      if (invoice === "overpaid") {
        res.status(400).json({ error: "The amount paid cannot be more than the bill total." });
        return;
      }
      if (!invoice) return missing(res, "That bill was not found.");
      res.json(invoice);
    } catch (error) {
      databaseError(res, error);
    }
  });

  router.post("/businesses/:id/invoices/:invoiceId/cancel", async (req, res) => {
    try {
      const invoice = await store.cancelInvoice(options.adminId(res), req.params.id, req.params.invoiceId);
      if (!invoice) return missing(res, "That bill was not found.");
      res.json(invoice);
    } catch (error) {
      databaseError(res, error);
    }
  });

  return router;
}

function normaliseCustomer(input: z.infer<typeof customerSchema>): CustomerInput {
  return {
    ...input,
    gstin: input.kind === "registered" ? input.gstin.toUpperCase() : "",
    phone: input.phone.replace(/\s+/g, ""),
    state: input.state || stateFromGstin(input.gstin),
  };
}

/** The same buyer typed again: same GSTIN, else same phone, else same name with neither. */
function sameCustomer<T extends CustomerInput & { id: string }>(customers: T[], input: CustomerInput): T | null {
  if (input.gstin) {
    const byGstin = customers.find((customer) => customer.gstin === input.gstin);
    if (byGstin) return byGstin;
  }
  if (input.phone) {
    const byPhone = customers.find((customer) => customer.phone === input.phone && customer.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    if (byPhone) return byPhone;
  }
  if (!input.gstin && !input.phone) {
    return customers.find((customer) => !customer.gstin && !customer.phone && customer.name.trim().toLowerCase() === input.name.trim().toLowerCase()) ?? null;
  }
  return null;
}

/** Keep details the earlier record had when the new one leaves them blank. */
function mergeCustomer(saved: CustomerInput, input: CustomerInput): CustomerInput {
  return {
    ...input,
    gstin: input.gstin || saved.gstin,
    kind: input.gstin || saved.gstin ? "registered" : "unregistered",
    phone: input.phone || saved.phone,
    address: input.address || saved.address,
    state: input.state || saved.state,
  };
}

function normaliseBusiness(input: z.infer<typeof businessSchema>) {
  return {
    ...input,
    invoicePrefix: input.invoicePrefix.toUpperCase(),
    gstin: input.gstRegistered ? input.gstin.toUpperCase() : "",
    defaultGstRate: input.gstRegistered ? input.defaultGstRate : 0,
  };
}

function fail(res: express.Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0]?.message ?? "Check the fields." });
}

function missing(res: express.Response, error: string) {
  res.status(404).json({ error });
}

function databaseError(res: express.Response, error: unknown) {
  console.error(error);
  const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (
    ["billing_create_invoice", "amount_paid", "round_off", "payable", "client_ref", "customer_phone", "place_of_supply", "due_on", "show_hsn", "bank_name", "upi_id", "logo", "layout", "entity", "description", "payment_check"].some((name) =>
      message.includes(name),
    )
  ) {
    res.status(500).json({ error: "Billing needs an update. Run billing/sql/invoices-v2.sql in the Supabase SQL editor." });
    return;
  }
  if (message.includes("billing_customers") || message.includes("customer_kind") || message.includes("customer_address")) {
    res.status(500).json({ error: "Customers are missing. Run billing/sql/customers.sql in the Supabase SQL editor." });
    return;
  }
  if (message.includes("billing_")) {
    res.status(500).json({ error: "Billing tables are missing. Run billing/sql/schema.sql in the Supabase SQL editor." });
    return;
  }
  res.status(500).json({ error: "The database request failed." });
}
