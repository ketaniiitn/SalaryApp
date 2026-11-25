import { amountInWords, balanceDue, formatDate, formatMoney, sellerSnapshot, taxByRate } from "./gst";
import { stateCode } from "./states";
import type { Business, CalculatedBill, Invoice, Payment, SellerSnapshot } from "./types";
import { lineMeasure } from "./units";

/**
 * Everything printed on one invoice. The live preview and the PDF are both made
 * from this, by the same function, so what the user sees is what prints.
 */
export type InvoiceDocument = {
  seller: SellerSnapshot;
  logo: string;
  number: string;
  issuedOn: string;
  dueOn: string | null;
  poNumber: string;
  placeOfSupply: string;
  paymentTerms: string;
  buyer: { name: string; gstin: string; address: string; state: string; phone: string };
  bill: CalculatedBill;
  payment: Payment;
  amountPaid: number;
  notes: string;
  terms: string;
  cancelled: boolean;
};

export function documentFromInvoice(business: Business, invoice: Invoice): InvoiceDocument {
  return {
    seller: invoice.seller ?? sellerSnapshot(business),
    logo: business.logo,
    number: invoice.number,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    poNumber: invoice.poNumber,
    placeOfSupply: invoice.placeOfSupply || invoice.customerState,
    paymentTerms: invoice.paymentTerms,
    buyer: {
      name: invoice.customerName,
      gstin: invoice.customerGstin,
      address: invoice.customerAddress,
      state: invoice.customerState,
      phone: invoice.customerPhone,
    },
    bill: invoice,
    payment: invoice.payment,
    amountPaid: invoice.amountPaid,
    notes: invoice.notes,
    terms: invoice.terms,
    cancelled: invoice.status === "cancelled",
  };
}

/** A whole printable page, for Print and the PDF. */
export function invoiceHtml(doc: InvoiceDocument): string {
  return page(invoiceBody(doc), false);
}

/** A page that scales the A4 sheet to the window and accepts new bodies through window.__setInvoice. */
export function invoicePreviewHtml(doc: InvoiceDocument): string {
  return page(invoiceBody(doc), true);
}

const PAYMENT_LABEL: Record<Payment, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  unpaid: "Not paid yet",
};

export function invoiceBody(doc: InvoiceDocument): string {
  const { seller, bill } = doc;
  const gst = seller.gstRegistered;
  const compact = seller.layout === "compact";
  const showHsn = seller.showHsn && bill.lines.some((line) => line.hsn.trim());
  const showDiscount = bill.discount > 0;
  const place = doc.placeOfSupply || seller.state;
  const code = stateCode(place);

  const head = `<tr>
      <th class="n">#</th>
      <th>Item</th>
      ${showHsn ? "<th>HSN/SAC</th>" : ""}
      <th class="r">Qty</th>
      <th class="r">Rate</th>
      ${showDiscount ? '<th class="r">Discount</th>' : ""}
      ${gst && !compact ? '<th class="r">Taxable</th><th class="r">GST</th>' : ""}
      <th class="r">Amount</th>
    </tr>`;

  const rows = bill.lines.length
    ? bill.lines
        .map((line, index) => {
          const gstNote = gst && compact ? `<div class="muted">GST ${line.gstRate}%${line.priceMode === "inclusive" ? " incl." : ""}</div>` : "";
          return `<tr>
          <td class="n">${index + 1}</td>
          <td><div class="item">${esc(line.name)}</div>${line.description ? `<div class="muted">${esc(line.description)}</div>` : ""}${gstNote}</td>
          ${showHsn ? `<td>${esc(line.hsn)}</td>` : ""}
          <td class="r">${esc(lineMeasure(line))}</td>
          <td class="r">${formatMoney(line.unitPrice)}${line.priceMode === "inclusive" && gst ? '<div class="muted">incl. GST</div>' : ""}</td>
          ${showDiscount ? `<td class="r">${line.discount ? formatMoney(line.discount) : "—"}</td>` : ""}
          ${gst && !compact ? `<td class="r">${formatMoney(line.taxableValue)}</td><td class="r">${line.supply === "taxable" ? `${line.gstRate}%<div class="muted">${formatMoney(line.tax)}</div>` : esc(supplyLabel(line.supply))}</td>` : ""}
          <td class="r strong">${formatMoney(line.total)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td class="empty" colspan="9">Items you add appear here.</td></tr>`;

  const totals = [
    showDiscount ? row("Subtotal", formatMoney(bill.subtotal)) : "",
    showDiscount ? row("Discount", `− ${formatMoney(bill.discount)}`) : "",
    gst ? row("Taxable value", formatMoney(bill.taxableValue)) : "",
    gst && !bill.interstate ? row("CGST", formatMoney(bill.cgst)) : "",
    gst && !bill.interstate ? row("SGST", formatMoney(bill.sgst)) : "",
    gst && bill.interstate ? row("IGST", formatMoney(bill.igst)) : "",
    bill.roundOff ? row("Round off", `${bill.roundOff > 0 ? "+ " : "− "}${formatMoney(Math.abs(bill.roundOff))}`) : "",
    `<tr class="grand"><td>Total</td><td class="r">${formatMoney(bill.payable)}</td></tr>`,
    doc.amountPaid > 0 ? row(`Paid${doc.payment !== "unpaid" ? ` · ${PAYMENT_LABEL[doc.payment]}` : ""}`, formatMoney(doc.amountPaid)) : "",
    doc.amountPaid > 0 ? row("Balance due", formatMoney(balanceDue({ amountPaid: doc.amountPaid, payable: bill.payable }))) : "",
  ].join("");

  const rates = gst ? taxByRate(bill.lines).filter((rate) => rate.tax > 0) : [];
  const rateTable = rates.length
    ? `<table class="rates">
        <thead><tr><th>GST rate</th><th class="r">Taxable value</th>${bill.interstate ? '<th class="r">IGST</th>' : '<th class="r">CGST</th><th class="r">SGST</th>'}<th class="r">Total tax</th></tr></thead>
        <tbody>${rates
          .map(
            (rate) => `<tr><td>${rate.rate}%</td><td class="r">${formatMoney(rate.taxableValue)}</td>${
              bill.interstate
                ? `<td class="r">${formatMoney(rate.igst)}</td>`
                : `<td class="r">${formatMoney(rate.cgst)} <span class="muted">(${rate.rate / 2}%)</span></td><td class="r">${formatMoney(rate.sgst)} <span class="muted">(${rate.rate / 2}%)</span></td>`
            }<td class="r">${formatMoney(rate.tax)}</td></tr>`,
          )
          .join("")}</tbody>
      </table>`
    : "";

  const bank = [
    seller.bankName ? `Bank: ${esc(seller.bankName)}` : "",
    seller.bankAccount ? `A/c no: ${esc(seller.bankAccount)}` : "",
    seller.bankIfsc ? `IFSC: ${esc(seller.bankIfsc)}` : "",
    seller.upiId ? `UPI: ${esc(seller.upiId)}` : "",
  ].filter(Boolean);

  const meta = [
    ["Invoice no", esc(doc.number)],
    ["Date", esc(formatDate(doc.issuedOn))],
    doc.dueOn ? ["Due date", esc(formatDate(doc.dueOn))] : null,
    doc.paymentTerms ? ["Terms", esc(doc.paymentTerms)] : null,
    doc.poNumber ? ["PO number", esc(doc.poNumber)] : null,
  ].filter((entry): entry is string[] => entry !== null);

  const sellerLines = [
    seller.address ? esc(seller.address) : "",
    seller.state ? `${esc(seller.state)}${stateCode(seller.state) ? ` (${stateCode(seller.state)})` : ""}` : "",
    [seller.phone ? esc(seller.phone) : "", seller.email ? esc(seller.email) : ""].filter(Boolean).join("  |  "),
  ].filter(Boolean);

  const buyerName = doc.buyer.name.trim() ? esc(doc.buyer.name) : '<span class="placeholder">Customer name</span>';

  return `<div class="sheet ${compact ? "compact" : "standard"}${doc.cancelled ? " cancelled" : ""}">
  <header>
    <div class="seller">
      ${doc.logo.startsWith("data:image/") ? `<img class="logo" src="${esc(doc.logo)}" alt="" />` : ""}
      <div>
        <div class="name">${seller.name.trim() ? esc(seller.name) : '<span class="placeholder">Business name</span>'}</div>
        ${sellerLines.map((line) => `<div class="muted">${line}</div>`).join("")}
        ${gst && seller.gstin ? `<div class="gstin">GSTIN ${esc(seller.gstin)}</div>` : ""}
      </div>
    </div>
    <div class="title">
      <div class="doc">${gst ? "Tax Invoice" : "Invoice"}</div>
      <table class="meta">${meta.map(([label, value]) => `<tr><td class="muted">${label}</td><td class="r">${value}</td></tr>`).join("")}</table>
    </div>
  </header>
  ${doc.cancelled ? '<div class="void">Cancelled</div>' : ""}
  <section class="parties">
    <div>
      <div class="label">Bill to</div>
      <div class="buyer">${buyerName}</div>
      ${doc.buyer.address ? `<div class="muted">${esc(doc.buyer.address)}</div>` : ""}
      ${doc.buyer.state ? `<div class="muted">${esc(doc.buyer.state)}</div>` : ""}
      ${doc.buyer.phone ? `<div class="muted">Phone ${esc(doc.buyer.phone)}</div>` : ""}
      ${doc.buyer.gstin ? `<div class="gstin">GSTIN ${esc(doc.buyer.gstin)}</div>` : ""}
    </div>
    ${
      gst
        ? `<div class="supply">
      <div class="label">Place of supply</div>
      <div>${esc(place)}${code ? ` (${code})` : ""}</div>
      <div class="muted">${bill.interstate ? "Inter-state supply, IGST" : "Within the state, CGST and SGST"}</div>
    </div>`
        : ""
    }
  </section>
  <table class="items">
    <thead>${head}</thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="foot">
    <div class="words">
      <div class="label">Amount in words</div>
      <div>${esc(amountInWords(bill.payable))}</div>
      ${bank.length ? `<div class="label gap">Pay to</div>${bank.map((line) => `<div>${line}</div>`).join("")}` : ""}
      ${doc.notes ? `<div class="label gap">Notes</div><div class="pre">${esc(doc.notes)}</div>` : ""}
    </div>
    <table class="totals">${totals}</table>
  </section>
  ${rateTable}
  <section class="close">
    <div class="terms">${doc.terms ? `<div class="label">Terms and conditions</div><div class="pre">${esc(doc.terms)}</div>` : ""}</div>
    <div class="sign">
      <div>For ${esc(seller.name || "the business")}</div>
      <div class="line">Authorised signatory</div>
    </div>
  </section>
  ${seller.footer ? `<footer>${esc(seller.footer)}</footer>` : ""}
</div>`;
}

function row(label: string, value: string): string {
  return `<tr><td>${label}</td><td class="r">${value}</td></tr>`;
}

function supplyLabel(supply: string): string {
  return supply === "exempt" ? "Exempt" : supply === "nil" ? "Nil" : "Non-GST";
}

const STYLES = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #15171B; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 794px; min-height: 1123px; padding: 44px 48px 40px; background: #FFFFFF; position: relative; font-size: 12.5px; line-height: 1.45; border-top: 5px solid #0B6E5F; }
  .muted { color: #646A74; }
  .placeholder { color: #A2A7AF; }
  .label { color: #646A74; font-size: 11px; font-weight: 600; margin-bottom: 3px; }
  .gap { margin-top: 12px; }
  .pre { white-space: pre-wrap; }
  .r { text-align: right; }
  .n { width: 26px; color: #646A74; }
  .strong { font-weight: 600; }
  header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid #C4C8CE; }
  .seller { display: flex; gap: 14px; align-items: flex-start; max-width: 60%; }
  .logo { width: 64px; height: 64px; object-fit: contain; }
  .name { font-size: 20px; font-weight: 700; letter-spacing: -0.2px; margin-bottom: 2px; }
  .gstin { font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; }
  .title { text-align: right; min-width: 210px; }
  .doc { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 8px; color: #0B6E5F; }
  .meta { margin-left: auto; border-collapse: collapse; }
  .meta td { padding: 1px 0 1px 14px; }
  .parties { display: flex; justify-content: space-between; gap: 24px; padding: 16px 0; }
  .buyer { font-size: 14.5px; font-weight: 600; }
  .supply { text-align: right; }
  table.items { width: 100%; border-collapse: collapse; }
  .items th { text-align: left; font-size: 11px; font-weight: 600; color: #3D424B; background: #F4F5F6; padding: 8px 8px; border-top: 1px solid #15171B; border-bottom: 1px solid #15171B; }
  .items th.r { text-align: right; }
  .items td { padding: 9px 8px; border-bottom: 1px solid #E3E5E8; vertical-align: top; }
  .items .item { font-weight: 600; }
  .items .empty { color: #A2A7AF; text-align: center; padding: 28px 8px; }
  .foot { display: flex; justify-content: space-between; gap: 32px; padding-top: 16px; }
  .words { flex: 1; max-width: 52%; }
  table.totals { width: 300px; border-collapse: collapse; }
  .totals td { padding: 4px 0; }
  .totals .grand td { border-top: 1px solid #15171B; border-bottom: 1px solid #15171B; padding: 9px 0; font-size: 16px; font-weight: 700; }
  table.rates { width: 100%; border-collapse: collapse; margin-top: 22px; }
  .rates th { text-align: left; font-size: 11px; font-weight: 600; color: #3D424B; padding: 6px 8px; border-bottom: 1px solid #C4C8CE; }
  .rates th.r { text-align: right; }
  .rates td { padding: 6px 8px; border-bottom: 1px solid #E3E5E8; }
  .close { display: flex; justify-content: space-between; gap: 32px; margin-top: 28px; align-items: flex-end; }
  .terms { flex: 1; max-width: 60%; color: #3D424B; font-size: 11.5px; }
  .sign { text-align: right; min-width: 200px; }
  .sign .line { margin-top: 46px; padding-top: 6px; border-top: 1px solid #C4C8CE; color: #646A74; font-size: 11px; }
  footer { position: absolute; left: 48px; right: 48px; bottom: 24px; text-align: center; color: #646A74; font-size: 11px; border-top: 1px solid #E3E5E8; padding-top: 8px; }
  .void { position: absolute; top: 360px; left: 0; right: 0; text-align: center; font-size: 96px; font-weight: 800; color: rgba(179, 38, 30, 0.14); transform: rotate(-18deg); pointer-events: none; }
  .compact { font-size: 12px; padding: 32px 36px; }
  .compact header { padding-bottom: 12px; }
  .compact .name { font-size: 17px; }
  .compact .logo { width: 48px; height: 48px; }
  .compact .doc { font-size: 18px; }
  .compact .items td { padding: 6px 8px; }
  .compact .parties { padding: 12px 0; }
  .compact footer { left: 36px; right: 36px; }
`;

const FIT_SCRIPT = `
  (function () {
    var root = document.getElementById("root");
    function fit() {
      var sheet = root.firstElementChild;
      if (!sheet) return;
      var scale = Math.min(1, document.documentElement.clientWidth / 794);
      sheet.style.transformOrigin = "top left";
      sheet.style.transform = "scale(" + scale + ")";
      var height = Math.ceil(sheet.offsetHeight * scale);
      root.style.height = height + "px";
      root.style.width = Math.ceil(794 * scale) + "px";
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(height));
      else if (window.parent !== window) window.parent.postMessage({ invoiceHeight: height }, "*");
    }
    // The app calls __setInvoice directly (iframe contentWindow on web, injectJavaScript on native).
    // There is deliberately no "message" listener: any window could post HTML into it.
    window.__setInvoice = function (html) { root.innerHTML = html; fit(); };
    window.addEventListener("resize", fit);
    fit();
  })();
`;

function page(body: string, fit: boolean): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="${fit ? "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" : "width=794"}" />
  <style>${STYLES}${fit ? "body { background: #E3E5E8; } #root { overflow: hidden; margin: 0 auto; box-shadow: 0 1px 3px rgba(21,23,27,0.12); }" : ""}</style>
</head>
<body>
  <div id="root">${body}</div>
  ${fit ? `<script>${FIT_SCRIPT}</script>` : ""}
</body>
</html>`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
