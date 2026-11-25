import type {
  BusinessInput,
  CalculatedBill,
  CalculatedLine,
  LineInput,
  PaymentStatus,
  PriceMode,
  SellerSnapshot,
  Supply,
} from "./types";

/** Common slabs. A business can still type another rate. */
export const GST_RATES = [0, 5, 12, 18, 28] as const;

export function indiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function indiaMonth(): string {
  return indiaToday().slice(0, 7);
}

/** First and last real day of YYYY-MM. November ends on the 30th, not the 31st. */
export function monthSpan(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Intra-state when the place of supply is blank or the same as the seller's state. */
export function isInterstate(businessState: string, placeOfSupply: string): boolean {
  const place = placeOfSupply.trim().toLowerCase();
  if (!place) return false;
  return place !== businessState.trim().toLowerCase();
}

/**
 * GST for one bill. Amounts are rupees rounded to paise.
 * A rate or a price change later does not pass through here again:
 * the invoice stores the result of this call.
 */
export function calculateBill(
  lines: LineInput[],
  interstate: boolean,
  gstRegistered: boolean,
  roundToRupee = false,
): CalculatedBill {
  const calculated = lines.map((line) => calculateLine(line, interstate, gstRegistered));
  const total = sumPaise(calculated, "total");
  const payable = roundToRupee ? Math.round(total / 100) * 100 : total;
  return {
    interstate,
    lines: calculated,
    subtotal: paiseToRupees(lines.reduce((sum, line) => sum + rupeesToPaise(line.unitPrice * line.quantity), 0)),
    discount: paiseToRupees(lines.reduce((sum, line) => sum + Math.min(rupeesToPaise(line.discount), rupeesToPaise(line.unitPrice * line.quantity)), 0)),
    taxableValue: paiseToRupees(sumPaise(calculated, "taxableValue")),
    cgst: paiseToRupees(sumPaise(calculated, "cgst")),
    sgst: paiseToRupees(sumPaise(calculated, "sgst")),
    igst: paiseToRupees(sumPaise(calculated, "igst")),
    tax: paiseToRupees(sumPaise(calculated, "tax")),
    total: paiseToRupees(total),
    roundOff: paiseToRupees(payable - total),
    payable: paiseToRupees(payable),
  };
}

export function calculateLine(line: LineInput, interstate: boolean, gstRegistered: boolean): CalculatedLine {
  const supply: Supply = gstRegistered ? line.supply : "non-gst";
  const rate = supply === "taxable" ? line.gstRate : 0;
  const extended = rupeesToPaise(line.unitPrice * line.quantity);
  const discount = Math.min(rupeesToPaise(line.discount), extended);
  const net = extended - discount;
  const inclusive = rate !== 0 && line.priceMode === "inclusive";
  // All amounts here are whole paise.
  //
  // Inter-state (IGST): one tax at the full rate, rounded to paise.
  //   exclusive: taxable = net, tax = round(net × rate / 100)
  //   inclusive: taxable = round(net × 100 / (100 + rate)), tax = net − taxable
  //
  // Intra-state (CGST + SGST): each half is a tax at rate / 2 in its own right, so
  // CGST is rounded to paise and SGST is the same amount; tax = 2 × CGST. Splitting
  // a rounded whole tax instead gives halves that differ by a paisa (₹10.03 at 18%:
  // 0.90 + 0.91), which is not CGST at 9% and SGST at 9%.
  //   exclusive: taxable = net, CGST = SGST = round(net × (rate / 2) / 100)
  //   inclusive: the customer must pay exactly the price shown, so taxable + tax == net
  //     has to hold. Start from the back-calculated taxable value, halve the tax that
  //     leaves, round it to paise (half a paisa rounds up), and let the taxable value
  //     absorb the difference: taxable = net − 2 × CGST. When net − taxable is odd this
  //     moves the taxable value by one paisa, which keeps both halves equal and the
  //     line total equal to the price.
  let taxable = net;
  let cgst = 0;
  let igst = 0;
  if (rate !== 0 && interstate) {
    if (inclusive) taxable = Math.round((net * 100) / (100 + rate));
    igst = inclusive ? net - taxable : Math.round((net * rate) / 100);
  } else if (rate !== 0) {
    cgst = inclusive ? Math.round((net - Math.round((net * 100) / (100 + rate))) / 2) : Math.round((net * rate) / 200);
    if (inclusive) taxable = net - 2 * cgst;
  }
  const sgst = cgst;
  const tax = cgst + sgst + igst;
  return {
    ...line,
    supply,
    gstRate: rate,
    taxableValue: paiseToRupees(taxable),
    cgst: paiseToRupees(cgst),
    sgst: paiseToRupees(sgst),
    igst: paiseToRupees(igst),
    tax: paiseToRupees(tax),
    total: paiseToRupees(taxable + tax),
  };
}

export type RateRow = { rate: number; taxableValue: number; cgst: number; sgst: number; igst: number; tax: number };

/** The tax table printed under the items: one row per GST rate. */
export function taxByRate(lines: CalculatedLine[]): RateRow[] {
  const rows = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const line of lines) {
    if (line.supply !== "taxable") continue;
    const row = rows.get(line.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += rupeesToPaise(line.taxableValue);
    row.cgst += rupeesToPaise(line.cgst);
    row.sgst += rupeesToPaise(line.sgst);
    row.igst += rupeesToPaise(line.igst);
    rows.set(line.gstRate, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, row]) => ({
      rate,
      taxableValue: paiseToRupees(row.taxable),
      cgst: paiseToRupees(row.cgst),
      sgst: paiseToRupees(row.sgst),
      igst: paiseToRupees(row.igst),
      tax: paiseToRupees(row.cgst + row.sgst + row.igst),
    }));
}

export function paymentStatus(invoice: { amountPaid: number; payable: number }): PaymentStatus {
  const paid = rupeesToPaise(invoice.amountPaid);
  if (paid <= 0) return "unpaid";
  return paid >= rupeesToPaise(invoice.payable) ? "paid" : "partial";
}

export function balanceDue(invoice: { amountPaid: number; payable: number }): number {
  return paiseToRupees(Math.max(0, rupeesToPaise(invoice.payable) - rupeesToPaise(invoice.amountPaid)));
}

export function sellerSnapshot(business: BusinessInput): SellerSnapshot {
  return {
    name: business.name,
    address: business.address,
    state: business.state,
    phone: business.phone,
    email: business.email,
    gstRegistered: business.gstRegistered,
    gstin: business.gstRegistered ? business.gstin : "",
    bankName: business.bankName,
    bankAccount: business.bankAccount,
    bankIfsc: business.bankIfsc,
    upiId: business.upiId,
    footer: business.footer,
    layout: business.layout,
    showHsn: business.showHsn,
  };
}

export function formatMoney(amount: number): string {
  const negative = amount < 0;
  const [whole, frac] = Math.abs(amount).toFixed(2).split(".");
  const tail = whole.slice(-3);
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}₹${head ? `${head},${tail}` : tail}.${frac}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-11-24 → 24 Nov 2026. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: crore, lakh, thousand. 1234.5 → "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const paise = Math.round(Math.abs(amount) * 100);
  let rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rupees) parts.push(belowThousand(rupees));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${fraction ? ` and ${belowHundred(fraction)} Paise` : ""} Only`;
}

export function invoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export function priceModeLabel(mode: PriceMode): string {
  return mode === "inclusive" ? "Price includes GST" : "GST added on top";
}

function sumPaise(lines: CalculatedLine[], key: "taxableValue" | "cgst" | "sgst" | "igst" | "tax" | "total"): number {
  return lines.reduce((total, line) => total + rupeesToPaise(line[key]), 0);
}

function rupeesToPaise(amount: number): number {
  return Math.round(amount * 100);
}

function paiseToRupees(paise: number): number {
  return paise / 100;
}
