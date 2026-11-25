import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Leader, LoadError, Row, Skeleton } from "@/components/book";
import { Button } from "@/components/button";
import { DateSheet } from "@/components/date-sheet";
import { Field, PickerField } from "@/components/field";
import { SearchIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { SelectSheet } from "@/components/select-sheet";
import { getBusiness, listInvoices } from "@/billing/api";
import { Choices } from "@/billing/choices";
import { addDays, balanceDue, formatDate, formatMoney, indiaToday, paymentStatus, type Business, type Invoice, type PaymentStatus } from "@/billing/engine";
import { isOffline } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";

type Period = "All time" | "Today" | "Last 7 days" | "This month" | "Last month" | "Choose dates";
const PERIODS: Period[] = ["All time", "Today", "Last 7 days", "This month", "Last month", "Choose dates"];
type StatusFilter = "all" | PaymentStatus;

function lastMonth(today: string): { from: string; to: string } {
  const firstOfThis = `${today.slice(0, 7)}-01`;
  const to = addDays(firstOfThis, -1);
  return { from: `${to.slice(0, 7)}-01`, to };
}

function rangeFor(period: Period, custom: { from: string; to: string }): { from?: string; to?: string } {
  const today = indiaToday();
  if (period === "Today") return { from: today, to: today };
  if (period === "Last 7 days") return { from: addDays(today, -6), to: today };
  if (period === "This month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "Last month") return lastMonth(today);
  if (period === "Choose dates") return custom;
  return {};
}

export default function InvoicesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [business, setBusiness] = useState<Business | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<Period>("All time");
  const [custom, setCustom] = useState(() => ({ from: `${indiaToday().slice(0, 7)}-01`, to: indiaToday() }));
  const [picking, setPicking] = useState<"period" | "from" | "to" | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [nextBusiness, nextInvoices] = await Promise.all([getBusiness(url, businessId), listInvoices(url, businessId, rangeFor(period, custom))]);
      setBusiness(nextBusiness);
      setInvoices(nextInvoices);
      setProblem(null);
    } catch (caught) {
      setProblem(isOffline(caught) ? "The phone could not reach the server." : caught instanceof Error ? caught.message : "Invoices could not be opened.");
    }
  }, [businessId, custom, period, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready]),
  );

  const needle = query.trim().toLowerCase();
  const shown = (invoices ?? []).filter((invoice) => {
    if (status !== "all" && (invoice.status !== "issued" || paymentStatus(invoice) !== status)) return false;
    if (!needle) return true;
    return invoice.number.toLowerCase().includes(needle) || invoice.customerName.toLowerCase().includes(needle) || invoice.customerPhone.includes(needle);
  });
  const issued = shown.filter((invoice) => invoice.status === "issued");
  const billed = issued.reduce((sum, invoice) => sum + Math.round(invoice.payable * 100), 0) / 100;
  const outstanding = issued.reduce((sum, invoice) => sum + Math.round(balanceDue(invoice) * 100), 0) / 100;

  return (
    <Page
      onRefresh={load}
      refreshing={false}
      back={{ label: business?.name ?? "Billing", fallback: { pathname: "/billing/[id]", params: { id: businessId } } }}
      dock={<Button label="New invoice" icon="plus" onPress={() => router.push({ pathname: "/billing/[id]/bill", params: { id: businessId } })} />}>
      <AppText variant="display" size="title">
        Invoices
      </AppText>
      <View>
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Invoice number, customer or phone"
          autoCorrect={false}
          suffix={
            <View className="pr-2.5">
              <SearchIcon />
            </View>
          }
        />
        <PickerField label="Dates" kind="date" value={period === "Choose dates" ? `${formatDate(custom.from)} to ${formatDate(custom.to)}` : period} onPress={() => setPicking("period")} />
        {period === "Choose dates" ? (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <PickerField label="From" kind="date" value={formatDate(custom.from)} onPress={() => setPicking("from")} />
            </View>
            <View className="flex-1">
              <PickerField label="To" kind="date" value={formatDate(custom.to)} onPress={() => setPicking("to")} />
            </View>
          </View>
        ) : null}
        <Choices
          label="Payment"
          value={status}
          options={[
            { id: "all" as StatusFilter, label: "All" },
            { id: "unpaid" as StatusFilter, label: "Unpaid" },
            { id: "partial" as StatusFilter, label: "Part paid" },
            { id: "paid" as StatusFilter, label: "Paid" },
          ]}
          onChange={setStatus}
        />
      </View>
      {problem ? <LoadError title="Couldn't open invoices." message={problem} onRetry={load} /> : null}
      {invoices === null && !problem ? <Skeleton width="100%" height={200} /> : null}
      {invoices !== null ? (
        <View>
          <Leader label={`${issued.length} ${issued.length === 1 ? "invoice" : "invoices"}`} value={formatMoney(billed)} />
          <Leader label="Still to collect" value={formatMoney(outstanding)} />
          <View className="mt-4 border-t border-rule">
            {shown.length === 0 ? (
              <AppText tone="ink2" className="py-5">
                {invoices.length === 0 ? "No invoices in these dates yet. Tap New invoice to make one." : "No invoices match. Clear the search or choose other dates."}
              </AppText>
            ) : null}
            {shown.map((invoice) => {
              const state = paymentStatus(invoice);
              const cancelled = invoice.status === "cancelled";
              return (
                <Row
                  key={invoice.id}
                  title={invoice.customerName || "Customer"}
                  subtitle={`${invoice.number}, ${formatDate(invoice.issuedOn)}`}
                  right={
                    <View className="items-end">
                      <AppText variant="figure" tone={cancelled ? "ink3" : "ink"} style={cancelled ? { textDecorationLine: "line-through" } : undefined}>
                        {formatMoney(invoice.payable)}
                      </AppText>
                      <AppText size="xs" variant="medium" tone={cancelled ? "cloth" : state === "paid" ? "stamp" : "ink3"}>
                        {cancelled ? "Cancelled" : state === "paid" ? "Paid" : state === "partial" ? `${formatMoney(balanceDue(invoice))} due` : "Unpaid"}
                      </AppText>
                    </View>
                  }
                  onPress={() => router.push({ pathname: "/billing/[id]/invoice/[invoiceId]", params: { id: businessId, invoiceId: invoice.id } })}
                />
              );
            })}
          </View>
        </View>
      ) : null}
      <SelectSheet visible={picking === "period"} title="Dates" options={PERIODS} value={period} searchable={false} onPick={(next) => setPeriod(next as Period)} onClose={() => setPicking(null)} />
      <DateSheet
        visible={picking === "from"}
        title="From"
        value={custom.from}
        max={custom.to}
        onPick={(from) => setCustom((current) => ({ ...current, from }))}
        onClose={() => setPicking(null)}
      />
      <DateSheet
        visible={picking === "to"}
        title="To"
        value={custom.to}
        min={custom.from}
        max={indiaToday()}
        onPick={(to) => setCustom((current) => ({ ...current, to }))}
        onClose={() => setPicking(null)}
      />
    </Page>
  );
}
