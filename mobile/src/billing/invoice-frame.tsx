import { useEffect, useRef, useState, type ComponentType, type Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView as NativeWebView } from "react-native-webview";

import { invoiceBody, invoicePreviewHtml, type InvoiceDocument } from "@/billing/engine";
import { colors } from "@/lib/theme";

type WebViewHandle = { injectJavaScript: (script: string) => void };

/** The props this screen uses. The package's own types resolve to never with this React Native version. */
const WebView = NativeWebView as unknown as ComponentType<{
  ref?: Ref<WebViewHandle>;
  originWhitelist: string[];
  source: { html: string };
  onLoadEnd: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  scrollEnabled: boolean;
  javaScriptEnabled: boolean;
  setBuiltInZoomControls: boolean;
  setDisplayZoomControls: boolean;
  style: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}>;

/**
 * The A4 invoice, drawn by the same HTML as the PDF and scaled to fit.
 * The page loads once; later changes replace its body so typing does not flash.
 */
export function InvoiceFrame({ doc, autoHeight = false }: { doc: InvoiceDocument; autoHeight?: boolean }) {
  const ref = useRef<WebViewHandle>(null);
  const [html] = useState(() => invoicePreviewHtml(doc));
  const [height, setHeight] = useState<number | null>(null);
  const loaded = useRef(false);
  const body = invoiceBody(doc);
  const latest = useRef(body);

  function push() {
    ref.current?.injectJavaScript(`window.__setInvoice && window.__setInvoice(${JSON.stringify(latest.current)}); true;`);
  }

  useEffect(() => {
    latest.current = body;
    if (!loaded.current) return;
    const timer = setTimeout(push, 90);
    return () => clearTimeout(timer);
  }, [body]);

  return (
    <View style={autoHeight ? { height: height ?? 420 } : { flex: 1 }} className="overflow-hidden bg-off">
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html }}
        onLoadEnd={() => {
          loaded.current = true;
          push();
        }}
        onMessage={(event) => {
          const next = Number(event.nativeEvent.data);
          if (next > 0) setHeight(next);
        }}
        scrollEnabled={!autoHeight}
        javaScriptEnabled={true}
        setBuiltInZoomControls={true}
        setDisplayZoomControls={false}
        style={{ flex: 1, backgroundColor: colors.off }}
        accessibilityLabel="Invoice preview"
      />
    </View>
  );
}
