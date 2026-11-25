import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { InvoiceFrame } from "@/billing/invoice-frame";
import type { InvoiceDocument } from "@/billing/engine";

/** The live invoice with a heading and Expand. Fills its parent unless autoHeight. */
export function InvoicePreview({
  doc,
  note,
  autoHeight = false,
}: {
  doc: InvoiceDocument;
  /** One line under the heading, such as "The number is confirmed when you generate." */
  note?: string;
  autoHeight?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className={autoHeight ? "" : "flex-1"}>
      <View className="mb-2 flex-row items-end justify-between">
        <View className="mr-3 flex-1">
          <AppText variant="semibold" size="lg">
            Invoice preview
          </AppText>
          {note ? (
            <AppText size="sm" tone="ink3">
              {note}
            </AppText>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} hitSlop={8} className="rounded-md border-2 border-ink px-3 py-1.5 active:bg-sheet">
          <AppText variant="semibold" size="sm">
            Expand
          </AppText>
        </Pressable>
      </View>
      <View className={`overflow-hidden rounded-md border border-rule ${autoHeight ? "" : "flex-1"}`}>
        <InvoiceFrame doc={doc} autoHeight={autoHeight} />
      </View>
      <ExpandedInvoice doc={doc} visible={expanded} onClose={() => setExpanded(false)} />
    </View>
  );
}

function ExpandedInvoice({ doc, visible, onClose }: { doc: InvoiceDocument; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between border-b border-rule px-5 py-3">
          <View>
            <AppText variant="semibold" size="lg">
              {doc.number}
            </AppText>
            <AppText size="sm" tone="ink3">
              Pinch to zoom
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} className="rounded-md border-2 border-ink px-4 py-2 active:bg-sheet">
            <AppText variant="semibold">Close</AppText>
          </Pressable>
        </View>
        <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
          {visible ? <InvoiceFrame doc={doc} /> : null}
        </View>
      </View>
    </Modal>
  );
}
