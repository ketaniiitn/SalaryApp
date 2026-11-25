import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
import { Row } from "@/components/book";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Page } from "@/components/page";
import { createItem, deleteItem, getBusiness, listItems } from "@/billing/api";
import { Choices } from "@/billing/choices";
import { formatMoney, GST_RATES, type Business, type Item, type PriceMode, type Supply } from "@/billing/engine";
import { useServerUrl } from "@/lib/server-url";

export default function ItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessId = Array.isArray(id) ? id[0] : id;
  const { url, ready } = useServerUrl();
  const [business, setBusiness] = useState<Business | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [hsn, setHsn] = useState("");
  const [unit, setUnit] = useState("");
  const [rate, setRate] = useState("5");
  const [priceMode, setPriceMode] = useState<PriceMode>("exclusive");
  const [supply, setSupply] = useState<Supply>("taxable");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    const [nextBusiness, nextItems] = await Promise.all([getBusiness(url, businessId), listItems(url, businessId)]);
    setBusiness(nextBusiness);
    setItems(nextItems);
    setRate(String(nextBusiness.defaultGstRate));
    setPriceMode(nextBusiness.defaultPriceMode);
  }, [businessId, url]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load().catch((caught) => setError(caught instanceof Error ? caught.message : "Items could not be opened."));
    }, [load, ready]),
  );

  async function save() {
    const amount = Number(price);
    const gstRate = Number(rate);
    if (!name.trim()) return setError("Enter the item name.");
    if (!Number.isFinite(amount) || amount < 0) return setError("Enter the price.");
    if (!businessId || !business) return;
    setSaving(true);
    setError(null);
    try {
      await createItem(url, businessId, {
        name: name.trim(),
        description: description.trim(),
        price: amount,
        hsn: hsn.trim(),
        unit: unit.trim(),
        gstRate: business.gstRegistered ? gstRate : 0,
        priceMode,
        supply: business.gstRegistered ? supply : "non-gst",
      });
      setName("");
      setDescription("");
      setPrice("");
      setHsn("");
      setUnit("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That item was not saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId: string) {
    if (!businessId) return;
    try {
      await deleteItem(url, businessId, itemId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That item was not removed.");
    }
  }

  return (
    <Page
      keyboard
      back={{ label: business?.name ?? "Business", fallback: { pathname: "/billing/[id]", params: { id: businessId } } }}
      dock={<Button label={saving ? "Saving…" : "Save item"} loading={saving} onPress={save} />}>
      <AppText variant="display" size="title">
        Saved items
      </AppText>
      <AppText tone="ink2">Optional. Save what you sell often, or tick “Save to my items” while making an invoice.</AppText>
      {error ? <AppText tone="cloth">{error}</AppText> : null}
      <View className="border-t border-rule">
        {items.length === 0 ? <AppText className="py-4">No saved items yet.</AppText> : null}
        {items.map((item) => (
          <Row
            key={item.id}
            title={item.name}
            subtitle={`${formatMoney(item.price)}${item.unit ? ` per ${item.unit}` : ""} · ${item.supply === "taxable" ? `${item.gstRate}% GST` : "No GST"}`}
            right={
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => remove(item.id)} className="px-2 py-2">
                <AppText variant="semibold" tone="cloth">
                  Remove
                </AppText>
              </Pressable>
            }
          />
        ))}
      </View>
      <AppText variant="display" size="h3">
        Add an item
      </AppText>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Cutting chai" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional, printed under the name" />
      <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" prefix="₹" placeholder="10" />
      <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="cup, kg, hour" />
      <Field label="HSN or SAC" value={hsn} onChangeText={setHsn} placeholder="Optional" />
      {business?.gstRegistered ? (
        <View>
          <Choices
            label="Price"
            value={priceMode}
            options={[
              { id: "exclusive", label: "Add GST on top" },
              { id: "inclusive", label: "Price includes GST" },
            ]}
            onChange={setPriceMode}
          />
          <Choices
            label="GST"
            value={supply === "taxable" ? rate : supply}
            options={[
              ...GST_RATES.map((value) => ({ id: String(value), label: `${value}%` })),
              { id: "exempt", label: "Exempt" },
              { id: "nil", label: "Nil" },
              { id: "non-gst", label: "Non-GST" },
            ]}
            onChange={(id) => {
              if (id === "exempt" || id === "nil" || id === "non-gst") setSupply(id);
              else {
                setSupply("taxable");
                setRate(id);
              }
            }}
          />
        </View>
      ) : null}
    </Page>
  );
}
