import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/** Phone: the system print sheet, showing the invoice HTML. */
export async function printInvoice(html: string, _title: string): Promise<void> {
  await Print.printAsync({ html });
}

/** Phone: make a PDF file and open the share sheet. "unavailable" when this phone cannot share files. */
export async function shareInvoicePdf(html: string, title: string): Promise<"shared" | "unavailable"> {
  return sharePdf(html, title);
}

/**
 * Phone: the same PDF, offered to WhatsApp through the share sheet.
 * The wa.me link can only send text, so the invoice goes as a file.
 */
export async function sendInvoiceOnWhatsApp(html: string, title: string): Promise<"shared" | "downloaded" | "unavailable" | "cancelled"> {
  return sharePdf(html, `Send ${title} on WhatsApp`);
}

async function sharePdf(html: string, title: string): Promise<"shared" | "unavailable"> {
  const file = await Print.printToFileAsync({ html, width: 794, height: 1123 });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
  return "shared";
}

/** The button label for the PDF action on this platform. */
export const PDF_ACTION_LABEL = "Share PDF";
