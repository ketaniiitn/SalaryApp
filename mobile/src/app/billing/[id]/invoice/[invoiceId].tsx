import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Banner, Leader, LoadError, SectionHead, Skeleton } from "@/components/book";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Page } from "@/components/page";
import { TextLink } from "@/components/text-link";
import { cancelInvoice, getBusiness, getInvoice, setPayment } from "@/billing/api";
import { Choices } from "@/billing/choices";
import type { Method, Received } from "@/billing/draft";
import { balanceDue, documentFromInvoice, formatDate, formatMoney, paymentStatus, type Business, type Invoice, type PaymentStatus } from "@/billing/engine";
import { invoiceHtml } from "@/billing/invoice-html";
import { InvoicePreview } from "@/billing/preview";
import { PDF_ACTION_LABEL, printInvoice, sendInvoiceOnWhatsApp, shareInvoicePdf } from "@/billing/print";
import { isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

const STATUS_LABEL: Record<PaymentStatus, string> = { paid: "Paid", partial: "Part paid", unpaid: "Unpaid" };

export default function InvoiceScreen() {
  const { id, invoiceId, created } = useLocalSearchParams<{ id: string; invoiceId: string; created?: string }>();
  const businessId = Array.isArray(id) ? id[0] : id;
  const billId = Array.isArray(invoiceId) ? invoiceId[0] : invoiceId;
  const justMade = created === "1";
  const { url, ready } = useServerUrl();
  const [business, setBusiness] = useState<Business | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [working, setWorking] = useState<"print" | "share" | "whatsapp" | "pay" | "cancel" | null>(null);
  const [received, setReceived] = useState<Received>("none");
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("");

  const showPayment = useCallback((next: Invoice) => {
    const status = paymentStatus(next);
    setReceived(status === "paid" ? "full" : status === "partial" ? "part" : "none");
    setMethod(next.payment === "unpaid" ? "cash" : next.payment);
    setAmount(status === "partial" ? String(next.amountPaid) : "");
  }, []);

  const load = useCallback(async () => {
    if (!businessId || !billId) return;
    try {
      const [nextBusiness, nextInvoice] = await Promise.all([getBusiness(url, businessId), getInvoice(url, businessId, billId)]);
      setBusiness(nextBusiness);
      setInvoice(nextInvoice);
      showPayment(nextInvoice);
      setProblem(null);
    } catch (caught) {
      setProblem(isOffline(caught) ? "The phone could not reach the server." : caught instanceof Error ? caught.message : "That invoice could not be opened.");
    }
  }, [billId, businessId, showPayment, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  async function printBill() {
    if (!business || !invoice) return;
    setWorking("print");
    setError(null);
    try {
      await printInvoice(invoiceHtml(business, invoice), invoice.number);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice was not printed.");
    } finally {
      setWorking(null);
    }
  }

  async function share() {
    if (!business || !invoice) return;
    setWorking("share");
    setError(null);
    try {
      const result = await shareInvoicePdf(invoiceHtml(business, invoice), invoice.number);
      if (result === "unavailable") setError("Sharing is not available on this phone. Use Print to save a PDF instead.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF was not shared.");
    } finally {
      setWorking(null);
    }
  }

  async function whatsapp() {
    if (!business || !invoice) return;
    setWorking("whatsapp");
    setError(null);
    setNotice(null);
    try {
      const result = await sendInvoiceOnWhatsApp(invoiceHtml(business, invoice), invoice.number);
      if (result === "unavailable") setError("Sharing is not available on this phone. Use Share PDF instead.");
      if (result === "downloaded") setNotice(`${invoice.number}.pdf was downloaded. Attach that file in WhatsApp. This browser can't place the file in the chat for you.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice PDF was not created.");
    } finally {
      setWorking(null);
    }
  }

  async function savePayment() {
    if (!businessId || !billId || !invoice || invoice.status !== "issued") return;
    const paid = Number(amount);
    if (received === "part" && (!Number.isFinite(paid) || paid <= 0)) {
      setError("Enter how much was paid.");
      return;
    }
    setWorking("pay");
    setError(null);
    setNotice(null);
    try {
      const next = await setPayment(url, businessId, billId, received === "none" ? "unpaid" : method, received === "part" ? paid : null);
      setInvoice(next);
      showPayment(next);
      setNotice("Payment saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment was not saved.");
    } finally {
      setWorking(null);
    }
  }

  async function cancel() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    if (!businessId || !billId) return;
    setWorking("cancel");
    try {
      setInvoice(await cancelInvoice(url, businessId, billId));
      setConfirmCancel(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice was not cancelled.");
    } finally {
      setWorking(null);
    }
  }

  const status = invoice ? paymentStatus(invoice) : "unpaid";
  const due = invoice ? balanceDue(invoice) : 0;

  return (
    <Page
      back={{
        label: justMade ? business?.name ?? "Billing" : "Invoices",
        fallback: justMade ? { pathname: "/billing/[id]", params: { id: businessId } } : { pathname: "/billing/[id]/history", params: { id: businessId } },
      }}
      dock={
        invoice ? (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Print" variant="line" loading={working === "print"} disabled={working !== null} onPress={printBill} />
            </View>
            <View className="flex-[1.4]">
              <Button label={working === "share" ? "Making PDF…" : PDF_ACTION_LABEL} loading={working === "share"} disabled={working !== null} onPress={share} />
            </View>
          </View>
        ) : null
      }>
      {problem ? <LoadError title="Couldn't open this invoice." message={problem} onRetry={load} /> : null}
      {!invoice && !problem ? <Skeleton width="100%" height={420} /> : null}
      {invoice && business ? (
        <View className="gap-6">
          {justMade ? <Banner tone="info" title={`${invoice.number} is saved.`}>Share the PDF, print it, or send it on WhatsApp.</Banner> : null}
          {error ? <Banner tone="error">{error}</Banner> : null}
          <View>
            <AppText variant="display" size="title">
              {invoice.number}
            </AppText>
            <AppText tone="ink2" className="mt-1">
              {`${formatDate(invoice.issuedOn)}, ${invoice.customerName}`}
            </AppText>
            <View className="mt-2 flex-row">
              <View className={`rounded-md px-2.5 py-1 ${invoice.status === "cancelled" ? "bg-sheet" : status === "paid" ? "bg-stampsoft" : "bg-sheet"}`}>
                <AppText variant="semibold" size="sm" tone={invoice.status === "cancelled" ? "cloth" : status === "paid" ? "stamp" : "ink2"}>
                  {invoice.status === "cancelled" ? "Cancelled" : STATUS_LABEL[status]}
                </AppText>
              </View>
            </View>
            <View className="mt-4">
              <Leader label="Total" value={formatMoney(invoice.payable)} />
              {invoice.amountPaid > 0 ? <Leader label="Paid" value={formatMoney(invoice.amountPaid)} /> : null}
              {invoice.status === "issued" ? <Leader label="Balance due" value={formatMoney(due)} /> : null}
              {invoice.dueOn && due > 0 ? <Leader label="Due date" value={formatDate(invoice.dueOn)} /> : null}
            </View>
          </View>

          <InvoicePreview doc={documentFromInvoice(business, invoice)} autoHeight />

          <View className="gap-3">
            <Button
              label={working === "whatsapp" ? "Making PDF…" : "Send on WhatsApp"}
              variant="line"
              loading={working === "whatsapp"}
              disabled={working !== null}
              onPress={whatsapp}
            />
            <AppText size="sm" tone="ink3">
              Sends the invoice PDF. Pick WhatsApp, then the customer.
            </AppText>
            <Button label="Create another invoice" variant="line" icon="plus" onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId } })} />
            <View className="flex-row flex-wrap gap-x-6 gap-y-3 pt-1">
              {invoice.customerId ? (
                <TextLink
                  label={`New invoice for ${invoice.customerName}`}
                  onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId, customer: invoice.customerId ?? "" } })}
                />
              ) : null}
              <TextLink label="Duplicate this invoice" onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId, from: invoice.id } })} />
            </View>
          </View>

          {invoice.status === "issued" ? (
            <View>
              <SectionHead title="Payment" />
              <View className="pt-4">
                {notice ? (
                  <AppText tone="stamp" className="mb-3">
                    {notice}
                  </AppText>
                ) : null}
                <Choices
                  label="Received"
                  value={received}
                  options={[
                    { id: "none" as Received, label: "Not yet" },
                    { id: "full" as Received, label: "Paid in full" },
                    { id: "part" as Received, label: "Part paid" },
                  ]}
                  onChange={setReceived}
                />
                {received !== "none" ? (
                  <Choices
                    label="Paid by"
                    value={method}
                    options={[
                      { id: "cash" as Method, label: "Cash" },
                      { id: "upi" as Method, label: "UPI" },
                      { id: "card" as Method, label: "Card" },
                      { id: "bank" as Method, label: "Bank" },
                    ]}
                    onChange={setMethod}
                  />
                ) : null}
                {received === "part" ? <Field label="Total paid so far" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" prefix="₹" hint={`Out of ${formatMoney(invoice.payable)}`} /> : null}
                <Button label={working === "pay" ? "Saving…" : "Save payment"} variant="line" loading={working === "pay"} disabled={working !== null} onPress={savePayment} />
              </View>
            </View>
          ) : (
            <AppText tone="cloth">This invoice is cancelled. It stays here so the record and its number are not lost.</AppText>
          )}

          {invoice.status === "issued" ? (
            <View className="items-start">
              <TextLink label={confirmCancel ? "Tap again to cancel this invoice" : "Cancel this invoice"} tone="cloth" onPress={cancel} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}
