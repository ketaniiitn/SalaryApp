import { useEffect, useRef, useState } from "react";

import { invoiceBody, invoicePreviewHtml, type InvoiceDocument } from "@/billing/engine";

type InvoiceWindow = Window & { __setInvoice?: (html: string) => void };

/** Web build: the same invoice HTML in an iframe. */
export function InvoiceFrame({ doc, autoHeight = false }: { doc: InvoiceDocument; autoHeight?: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [html] = useState(() => invoicePreviewHtml(doc));
  const [height, setHeight] = useState<number | null>(null);
  const body = invoiceBody(doc);
  const latest = useRef(body);

  function push() {
    (ref.current?.contentWindow as InvoiceWindow | null)?.__setInvoice?.(latest.current);
  }

  useEffect(() => {
    latest.current = body;
    const timer = setTimeout(push, 60);
    return () => clearTimeout(timer);
  }, [body]);

  useEffect(() => {
    function listen(event: MessageEvent) {
      if (event.source !== ref.current?.contentWindow) return;
      const next = (event.data as { invoiceHeight?: number } | null)?.invoiceHeight;
      if (typeof next === "number" && next > 0) setHeight(next);
    }
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  return (
    <iframe
      ref={ref}
      title="Invoice preview"
      srcDoc={html}
      onLoad={push}
      style={{ border: 0, width: "100%", height: autoHeight ? (height ?? 420) : "100%", background: "#E3E5E8", display: "block" }}
    />
  );
}
