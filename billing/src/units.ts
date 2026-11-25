import type { LineInput } from "./types";

/** The same bill can serve another trade by choosing a different unit. The price always uses quantity × rate. */
export type Trade = "wholesale" | "retail" | "service";

export type UnitOption = {
  id: string;
  label: string;
  trades: Trade[];
};

export const UNITS: readonly UnitOption[] = [
  { id: "kg", label: "kg", trades: ["wholesale", "retail"] },
  { id: "g", label: "gram", trades: ["retail"] },
  { id: "quintal", label: "quintal", trades: ["wholesale"] },
  { id: "tonnes", label: "tonnes", trades: ["wholesale"] },
  { id: "bags", label: "bags", trades: ["wholesale"] },
  { id: "pieces", label: "pieces", trades: ["retail", "wholesale"] },
  { id: "boxes", label: "boxes", trades: ["retail", "wholesale"] },
  { id: "litres", label: "litres", trades: ["retail", "wholesale"] },
  { id: "units", label: "units", trades: ["retail", "wholesale", "service"] },
  { id: "hours", label: "hours", trades: ["service"] },
  { id: "service", label: "service", trades: ["service"] },
];

export function tradeForCategory(category: string): Trade {
  const text = category.toLowerCase();
  if (/salon|tuition|clinic|service|repair|consult/.test(text)) return "service";
  if (/kirana|grocery|cloth|retail|pharmacy|electronic|salon/.test(text)) return "retail";
  return "wholesale";
}

export function unitsFor(trade: Trade): UnitOption[] {
  return [...UNITS.filter((unit) => unit.trades.includes(trade)), ...UNITS.filter((unit) => !unit.trades.includes(trade))];
}

/** Bags sit beside a weighed quantity. They never change the rupees. */
export function unitUsesPacks(unitId: string): boolean {
  return unitId === "kg" || unitId === "quintal" || unitId === "tonnes" || unitId === "tonne";
}

export function formatQuantity(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function lineMeasure(line: Pick<LineInput, "packs" | "packUnit" | "quantity" | "unit">): string {
  const quantity = `${formatQuantity(line.quantity)}${line.unit ? ` ${line.unit}` : ""}`;
  if (line.packs != null && line.packs > 0) return `${formatQuantity(line.packs)} ${line.packUnit || "bags"} · ${quantity}`;
  return quantity;
}

export function quantitySummary(lines: Pick<LineInput, "packs" | "packUnit" | "quantity" | "unit">[]): string {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.packs != null && line.packs > 0) {
      const pack = line.packUnit || "bags";
      totals.set(pack, (totals.get(pack) ?? 0) + line.packs);
    }
    const unit = line.unit || "units";
    totals.set(unit, (totals.get(unit) ?? 0) + line.quantity);
  }
  return [...totals.entries()].map(([unit, amount]) => `${formatQuantity(amount)} ${unit}`).join(" · ");
}
