import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Browser: expo-print only calls window.print() on the whole page, which prints the screen
 * and its buttons. This prints just the invoice, from a hidden frame.
 */
export function printInvoice(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", "Invoice to print");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";

    const cleanup = () => frame.remove();

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error("The print window could not be opened."));
        return;
      }
      win.addEventListener("afterprint", cleanup);
      // Some browsers never fire afterprint, so the frame is dropped after a while either way.
      setTimeout(cleanup, 120_000);
      win.focus();
      win.print();
      resolve();
    };

    frame.srcdoc = withTitle(html, title);
    document.body.appendChild(frame);
  });
}

/** The browser has no share sheet: the print window offers Save as PDF. */
export async function shareInvoicePdf(html: string, title: string): Promise<"printed"> {
  await printInvoice(html, title);
  return "printed";
}

/**
 * A PDF of the invoice, shared if this browser can hand a file to another app, otherwise downloaded.
 * WhatsApp's own link can only carry text, so the invoice has to travel as a file.
 */
export async function sendInvoiceOnWhatsApp(html: string, title: string): Promise<"shared" | "downloaded" | "unavailable" | "cancelled"> {
  const blob = await invoicePdf(html);
  const file = new File([blob], pdfName(title), { type: "application/pdf" });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  download(blob, file.name);
  return "downloaded";
}

/** Draw the same invoice HTML onto A4 pages and return the PDF bytes. */
async function invoicePdf(html: string): Promise<Blob> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-2000px;top:0;width:794px;height:1123px;border:0";
  const ready = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("The invoice could not be drawn."));
  });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  try {
    await ready;
    const doc = frame.contentDocument;
    const sheet = doc?.querySelector(".sheet");
    if (!doc || !(sheet instanceof HTMLElement)) throw new Error("The invoice could not be drawn.");
    frame.style.height = `${sheet.scrollHeight}px`;
    await doc.fonts?.ready;
    await Promise.all(
      [...doc.images].map(
        (image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
              }),
      ),
    );
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", width: 794, windowWidth: 794 });
    const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const image = canvas.toDataURL("image/jpeg", 0.92);
    let offset = 0;
    pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight);
    let remaining = imageHeight - pageHeight;
    while (remaining > 8) {
      offset -= pageHeight;
      pdf.addPage();
      pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight);
      remaining -= pageHeight;
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfName(title: string): string {
  const clean = title.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "");
  return `${clean || "invoice"}.pdf`;
}

/** The browser suggests the page title as the PDF's file name. */
export const PDF_ACTION_LABEL = "Save as PDF";

function withTitle(html: string, title: string): string {
  const safe = title.replace(/[&<>"']/g, " ");
  return html.includes("<title>") ? html : html.replace("<head>", `<head><title>${safe}</title>`);
}
