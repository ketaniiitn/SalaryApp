import assert from "node:assert/strict";
import { addDays, amountInWords, balanceDue, calculateBill, isInterstate, monthSpan, paymentStatus, taxByRate } from "./gst";
import { invoiceHtml, type InvoiceDocument } from "./invoice-html";
import type { LineInput } from "./types";

function line(patch: Partial<LineInput> = {}): LineInput {
  return {
    name: "Tea",
    description: "",
    quantity: 1,
    unitPrice: 100,
    gstRate: 5,
    priceMode: "exclusive",
    discount: 0,
    supply: "taxable",
    hsn: "",
    unit: "kg",
    packs: null,
    packUnit: "",
    itemId: null,
    ...patch,
  };
}

const exclusive = calculateBill([line()], false, true);
assert.equal(exclusive.lines[0].cgst, 2.5);
assert.equal(exclusive.lines[0].sgst, 2.5);
assert.equal(exclusive.lines[0].igst, 0);
assert.equal(exclusive.total, 105);

const inclusive = calculateBill([line({ priceMode: "inclusive" })], false, true);
assert.equal(inclusive.lines[0].taxableValue, 95.24);
assert.equal(inclusive.lines[0].cgst, 2.38);
assert.equal(inclusive.lines[0].sgst, 2.38);
assert.equal(inclusive.total, 100);

const outside = calculateBill([line({ priceMode: "exclusive", gstRate: 18, unitPrice: 100 })], true, true);
assert.equal(outside.igst, 18);
assert.equal(outside.cgst, 0);
assert.equal(outside.total, 118);

const clean = calculateBill([line({ priceMode: "inclusive", unitPrice: 118, gstRate: 18 })], false, true);
assert.equal(clean.taxableValue, 100);
assert.equal(clean.tax, 18);

const unregistered = calculateBill([line()], false, false);
assert.equal(unregistered.tax, 0);
assert.equal(unregistered.total, 100);
assert.equal(unregistered.lines[0].supply, "non-gst");

const bulk = calculateBill([line({ quantity: 100, unit: "kg", packs: 50, packUnit: "bags" })], false, true);
assert.equal(bulk.lines[0].packs, 50);
assert.equal(bulk.total, 10500);
assert.equal(bulk.tax, 500);

assert.equal(monthSpan("2026-11").end, "2026-11-30");
assert.equal(monthSpan("2026-12").end, "2026-12-31");
assert.equal(monthSpan("2024-02").end, "2024-02-29");

assert.equal(isInterstate("Maharashtra", ""), false);
assert.equal(isInterstate("Maharashtra", "Maharashtra"), false);
assert.equal(isInterstate("Maharashtra", "Gujarat"), true);

// The brief's example: 10 kg tea at ₹200/kg, 5%, GST on top, inside the state.
const tea = calculateBill([line({ quantity: 10, unitPrice: 200 })], false, true, true);
assert.equal(tea.subtotal, 2000);
assert.equal(tea.taxableValue, 2000);
assert.equal(tea.cgst, 50);
assert.equal(tea.sgst, 50);
assert.equal(tea.payable, 2100);
assert.equal(tea.roundOff, 0);

// Same sale to another state: one IGST line of 5%.
const teaOutside = calculateBill([line({ quantity: 10, unitPrice: 200 })], true, true, true);
assert.equal(teaOutside.igst, 100);
assert.equal(teaOutside.cgst + teaOutside.sgst, 0);

// ₹100 including 5% GST: ₹4.76 of it is tax.
const included = calculateBill([line({ priceMode: "inclusive" })], false, true);
assert.equal(included.tax, 4.76);
assert.equal(included.taxableValue, 95.24);

// Odd paise: CGST and SGST are each 2.5% of ₹10.10 = 0.2525, rounded to 0.25.
// The halves are equal and the tax is their sum (0.50), not 5% rounded (0.51) split unevenly.
const odd = calculateBill([line({ unitPrice: 10.1, gstRate: 5 })], false, true);
assert.equal(odd.tax, 0.5);
assert.equal(odd.cgst, 0.25);
assert.equal(odd.sgst, 0.25);

// ₹10.03 at 18%, GST on top, inside the state: 9% of 10.03 = 0.9027 → 0.90 each, tax 1.80.
const split = calculateBill([line({ unitPrice: 10.03, gstRate: 18 })], false, true);
assert.equal(split.lines[0].cgst, 0.9);
assert.equal(split.lines[0].sgst, 0.9);
assert.equal(split.tax, 1.8);
assert.equal(split.total, 11.83);
// The same line to another state keeps one IGST of 18% rounded: 1.8054 → 1.81.
const splitOutside = calculateBill([line({ unitPrice: 10.03, gstRate: 18 })], true, true);
assert.equal(splitOutside.igst, 1.81);
assert.equal(splitOutside.total, 11.84);

// ₹10.03 including 18% GST, inside the state. Back-calculated taxable 8.50 leaves 1.53 of tax,
// which cannot be split into two equal halves; each half rounds to 0.77, and the taxable value
// gives up the paisa (8.49) so the customer still pays exactly ₹10.03.
const splitIncluded = calculateBill([line({ unitPrice: 10.03, gstRate: 18, priceMode: "inclusive" })], false, true);
assert.equal(splitIncluded.lines[0].cgst, 0.77);
assert.equal(splitIncluded.lines[0].sgst, 0.77);
assert.equal(splitIncluded.tax, 1.54);
assert.equal(splitIncluded.taxableValue, 8.49);
assert.equal(splitIncluded.total, 10.03);
// Inter-state, the inclusive price keeps the plain back-calculation: 8.50 + 1.53 IGST.
const splitIncludedOutside = calculateBill([line({ unitPrice: 10.03, gstRate: 18, priceMode: "inclusive" })], true, true);
assert.equal(splitIncludedOutside.taxableValue, 8.5);
assert.equal(splitIncludedOutside.igst, 1.53);
assert.equal(splitIncludedOutside.total, 10.03);

// Bill and rate-table totals are the sums of the lines, with CGST = SGST on every row.
const several = calculateBill(
  [line({ unitPrice: 10.03, gstRate: 18 }), line({ unitPrice: 10.03, gstRate: 18, priceMode: "inclusive" }), line({ unitPrice: 10.1, gstRate: 5 })],
  false,
  true,
);
assert.equal(several.cgst, several.sgst);
assert.equal(Math.round(several.tax * 100), Math.round((several.cgst + several.sgst) * 100));
assert.equal(Math.round(several.total * 100), Math.round((several.taxableValue + several.tax) * 100));
const severalRates = taxByRate(several.lines);
assert.deepEqual(severalRates.map((row) => [row.rate, row.cgst, row.sgst, row.tax]), [[5, 0.25, 0.25, 0.5], [18, 1.67, 1.67, 3.34]]);

// Round off to the rupee, up and down.
const up = calculateBill([line({ unitPrice: 99.5, gstRate: 0 })], false, true, true);
assert.equal(up.payable, 100);
assert.equal(up.roundOff, 0.5);
const down = calculateBill([line({ unitPrice: 10.1, gstRate: 5 })], false, true, true);
assert.equal(down.total, 10.6);
assert.equal(down.payable, 11);
assert.equal(down.roundOff, 0.4);
const noRound = calculateBill([line({ unitPrice: 10.1 })], false, true, false);
assert.equal(noRound.payable, noRound.total);

// Discount comes off before GST.
const discounted = calculateBill([line({ quantity: 2, unitPrice: 500, discount: 100, gstRate: 18 })], false, true, false);
assert.equal(discounted.subtotal, 1000);
assert.equal(discounted.discount, 100);
assert.equal(discounted.taxableValue, 900);
assert.equal(discounted.tax, 162);
assert.equal(discounted.payable, 1062);

// Mixed rates are summarised per rate.
const mixed = calculateBill([line({ unitPrice: 100, gstRate: 5 }), line({ unitPrice: 200, gstRate: 18 }), line({ unitPrice: 50, gstRate: 5 })], false, true);
const rates = taxByRate(mixed.lines);
assert.deepEqual(rates.map((rate) => rate.rate), [5, 18]);
assert.equal(rates[0].taxableValue, 150);
assert.equal(rates[0].tax, 7.5);
assert.equal(rates[1].tax, 36);
assert.equal(mixed.tax, 43.5);

// Payment status.
assert.equal(paymentStatus({ amountPaid: 0, payable: 100 }), "unpaid");
assert.equal(paymentStatus({ amountPaid: 40, payable: 100 }), "partial");
assert.equal(paymentStatus({ amountPaid: 100, payable: 100 }), "paid");
assert.equal(balanceDue({ amountPaid: 40.25, payable: 100 }), 59.75);

assert.equal(addDays("2026-11-24", 7), "2026-12-01");
assert.equal(addDays("2026-12-30", 15), "2027-01-14");

assert.equal(amountInWords(2100), "Rupees Two Thousand One Hundred Only");
assert.equal(amountInWords(1234567.5), "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Fifty Paise Only");
assert.equal(amountInWords(105000000), "Rupees Ten Crore Fifty Lakh Only");

// The printed invoice carries the numbers, escapes text, and shows IGST only when inter-state.
const doc: InvoiceDocument = {
  seller: { name: "Sharma <Traders>", address: "MG Road", state: "Maharashtra", phone: "", email: "", gstRegistered: true, gstin: "27AAAAA0000A1Z5", bankName: "", bankAccount: "", bankIfsc: "", upiId: "shop@upi", footer: "", layout: "standard", showHsn: true },
  logo: "",
  number: "INV-0007",
  issuedOn: "2026-11-24",
  dueOn: null,
  poNumber: "",
  placeOfSupply: "Gujarat",
  paymentTerms: "",
  buyer: { name: "Ravi", gstin: "", address: "", state: "Gujarat", phone: "" },
  bill: teaOutside,
  payment: "unpaid",
  amountPaid: 0,
  notes: "",
  terms: "",
  cancelled: false,
};
const html = invoiceHtml(doc);
assert.ok(html.includes("Sharma &lt;Traders&gt;"));
assert.ok(html.includes("INV-0007"));
assert.ok(html.includes("IGST"));
assert.ok(!html.includes(">CGST<"));
assert.ok(html.includes("Gujarat (24)"));
assert.ok(html.includes("₹2,100.00"));

console.log("gst checks passed");
