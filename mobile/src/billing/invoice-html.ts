import { documentFromInvoice, invoiceHtml as renderInvoice, type Business, type Invoice } from "@/billing/engine";

/** The saved invoice as a printable page. Same renderer as the live preview. */
export function invoiceHtml(business: Business, invoice: Invoice): string {
  return renderInvoice(documentFromInvoice(business, invoice));
}
