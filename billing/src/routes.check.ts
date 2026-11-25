import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createBillingRouter } from "./routes";
import { createBillingStore, invoiceSearchFilter } from "./store";

process.env.SUPABASE_URL = "";
const owner = "00000000-0000-4000-8000-000000000001";
const organisation = "00000000-0000-4000-8000-000000000002";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api/billing",
  createBillingRouter({
    store: createBillingStore(),
    requireAdmin: (_req, _res, next) => next(),
    adminId: () => owner,
    ownsOrganisation: async (_owner, id) => id === organisation,
  }),
);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/billing`;

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const tea = {
  name: "Tea",
  description: "Assam CTC",
  quantity: 10,
  unitPrice: 200,
  gstRate: 5,
  priceMode: "exclusive",
  discount: 0,
  supply: "taxable",
  hsn: "0902",
  unit: "kg",
  packs: null,
  packUnit: "",
  itemId: null,
};

function bill(patch: Record<string, unknown> = {}) {
  return {
    clientRef: null,
    issuedOn: "2026-11-20",
    dueOn: null,
    customerId: null,
    customerName: "Ravi Traders",
    customerKind: "unregistered",
    customerGstin: "",
    customerState: "Maharashtra",
    customerAddress: "",
    customerPhone: "",
    placeOfSupply: "",
    paymentTerms: "",
    poNumber: "",
    notes: "",
    terms: "",
    payment: "unpaid",
    amountPaid: null,
    lines: [tea],
    expectedPayable: 2100,
    ...patch,
  };
}

try {
  const business = await call("POST", `/organisations/${organisation}`, {
    name: "Sharma Tea",
    category: "Tea wholesale",
    address: "MG Road",
    state: "Maharashtra",
    phone: "",
    gstRegistered: true,
    gstin: "27AAAAA0000A1Z5",
    invoicePrefix: "INV",
    defaultPriceMode: "exclusive",
    defaultGstRate: 5,
    upiId: "sharma@upi",
    roundOff: true,
  });
  assert.equal(business.status, 201, JSON.stringify(business.body));
  const id = business.body.id as string;
  assert.equal(business.body.layout, "standard");

  // The same GSTIN twice is one customer, not two.
  const first = await call("POST", `/businesses/${id}/customers`, { name: "Patel Stores", entity: "business", kind: "registered", gstin: "24BBBBB1111B1Z5", phone: "", address: "", state: "" });
  assert.equal(first.status, 201);
  assert.equal(first.body.state, "Gujarat");
  const again = await call("POST", `/businesses/${id}/customers`, { name: "Patel Stores Pvt", entity: "business", kind: "registered", gstin: "24BBBBB1111B1Z5", phone: "9876543210", address: "Surat", state: "" });
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);
  assert.equal(again.body.phone, "9876543210");
  assert.equal((await call("GET", `/businesses/${id}/customers`)).body.length, 1);

  // The server recalculates and saves the tea example.
  const saved = await call("POST", `/businesses/${id}/invoices`, bill());
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.number, "INV-0001");
  assert.equal(saved.body.cgst, 50);
  assert.equal(saved.body.payable, 2100);
  assert.equal(saved.body.seller.name, "Sharma Tea");

  // A total the server does not agree with is refused.
  const wrong = await call("POST", `/businesses/${id}/invoices`, bill({ expectedPayable: 2000 }));
  assert.equal(wrong.status, 409);

  // Inter-state by place of supply gives IGST.
  const outside = await call("POST", `/businesses/${id}/invoices`, bill({ customerId: first.body.id, customerKind: "registered", customerGstin: "24BBBBB1111B1Z5", customerState: "Gujarat" }));
  assert.equal(outside.body.igst, 100);
  assert.equal(outside.body.cgst, 0);

  // Saving the same draft twice returns the first invoice.
  const ref = "7d6f3a52-2c1e-4b1a-9a59-3f1e2d6c8b10";
  const once = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref }));
  const twice = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref }));
  assert.equal(once.body.id, twice.body.id);
  assert.equal(twice.status, 201);

  // The same clientRef with different details is a different bill: refused, not answered with the first one.
  const moreTea = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref, lines: [{ ...tea, quantity: 20 }], expectedPayable: 4200 }));
  assert.equal(moreTea.status, 409);
  assert.match(moreTea.body.error, /already saved with different details/);
  const otherTotal = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref, expectedPayable: 2000 }));
  assert.equal(otherTotal.status, 409);
  assert.match(otherTotal.body.error, /already saved with different details/);
  const otherBuyer = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref, customerName: "Someone Else" }));
  assert.equal(otherBuyer.status, 409);
  const thrice = await call("POST", `/businesses/${id}/invoices`, bill({ clientRef: ref }));
  assert.equal(thrice.body.id, once.body.id);

  // The database search filter: quoted, LIKE and quoting characters made into one-character wildcards, dates as ranges.
  assert.equal(invoiceSearchFilter("  "), null);
  assert.equal(
    invoiceSearchFilter(" Ravi, (Bros.) "),
    'number.ilike."%ravi, (bros.)%",customer_name.ilike."%ravi, (bros.)%",customer_phone.ilike."%ravi, (bros.)%"',
  );
  assert.equal(invoiceSearchFilter('50%_off*\\"x"'), 'number.ilike."%50__off___x_%",customer_name.ilike."%50__off___x_%",customer_phone.ilike."%50__off___x_%"');
  assert.ok(invoiceSearchFilter("2026-11")!.endsWith(",and(issued_on.gte.2026-11-01,issued_on.lte.2026-11-30)"));
  assert.ok(invoiceSearchFilter("2024-02-29")!.endsWith(",and(issued_on.gte.2024-02-29,issued_on.lte.2024-02-29)"));
  assert.ok(invoiceSearchFilter("2026")!.endsWith(",and(issued_on.gte.2026-01-01,issued_on.lte.2026-12-31)"));
  assert.ok(!invoiceSearchFilter("2026-02-30")!.includes("issued_on"));
  assert.ok(!invoiceSearchFilter("2026-13")!.includes("issued_on"));

  // Ten saves at once get ten different numbers.
  const burst = await Promise.all(Array.from({ length: 10 }, () => call("POST", `/businesses/${id}/invoices`, bill())));
  const numbers = new Set(burst.map((result) => result.body.number));
  assert.equal(numbers.size, 10);

  // Part payment, then paid in full, and no more than the total.
  const partial = await call("PATCH", `/businesses/${id}/invoices/${saved.body.id}`, { payment: "upi", amountPaid: 500 });
  assert.equal(partial.body.amountPaid, 500);
  const over = await call("PATCH", `/businesses/${id}/invoices/${saved.body.id}`, { payment: "upi", amountPaid: 5000 });
  assert.equal(over.status, 400);
  const full = await call("PATCH", `/businesses/${id}/invoices/${saved.body.id}`, { payment: "cash", amountPaid: null });
  assert.equal(full.body.amountPaid, 2100);

  const dueBefore = await call("POST", `/businesses/${id}/invoices`, bill({ dueOn: "2026-11-01" }));
  assert.equal(dueBefore.status, 400);

  // Search and date filters.
  const byName = await call("GET", `/businesses/${id}/invoices?q=ravi`);
  assert.ok(byName.body.length >= 10);
  const none = await call("GET", `/businesses/${id}/invoices?from=2026-11-21&to=2026-11-30`);
  assert.equal(none.body.length, 0);

  const summary = await call("GET", `/businesses/${id}/summary?month=2026-11`);
  assert.equal(summary.body.count, 13);
  assert.equal(summary.body.outstanding, 12 * 2100);

  console.log("route checks passed");
} finally {
  server.close();
}
