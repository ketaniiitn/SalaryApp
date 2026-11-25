import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { Segmented, Stepper } from "@/components/book";
import { Field, Hint, ErrorLine } from "@/components/field";
import { amountPayable, formatRupees, todayIso, type SalaryBasis } from "@/lib/pay";

/** Digits only; commas and spaces typed by the owner are ignored. */
export function readRupees(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return value > 0 && value <= 99999999 ? value : null;
}

/** The one line about the formula, shown only while editing salary. */
export function payLine(salary: number | null, basis: SalaryBasis): string {
  if (salary == null) return basis === "day" ? "Paid for each day present." : "Paid for days present.";
  return basis === "day"
    ? `${formatRupees(salary)} for each day present.`
    : `Paid for days present. Full month is ${formatRupees(salary)}.`;
}

/** Days from the joining date (or the 1st) up to today, in this month. */
export function daysSinceJoining(joinedOn: string): number {
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  if (joinedOn > today) return 0;
  const start = joinedOn > monthStart ? joinedOn : monthStart;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86400000) + 1;
}

export function earnedPreview(input: { salary: number | null; basis: SalaryBasis; workingDays: number; daysPresent: number }): number {
  if (input.salary == null) return 0;
  return Math.round(
    amountPayable({
      salary: input.salary,
      salaryBasis: input.basis,
      workingDays: input.workingDays,
      // A monthly salary pays at most the working days; a day wage pays every day present.
      daysWorked: input.basis === "month" ? Math.min(input.daysPresent, input.workingDays) : input.daysPresent,
    }),
  );
}

export function SalaryField({
  basis,
  onBasis,
  salaryText,
  onSalaryText,
  error,
}: {
  basis: SalaryBasis;
  onBasis: (basis: SalaryBasis) => void;
  salaryText: string;
  onSalaryText: (text: string) => void;
  error?: string | null;
}) {
  const salary = readRupees(salaryText);
  return (
    <View className="mb-5">
      <AppText variant="bold" size="base" className="mb-2">
        Salary
      </AppText>
      <Segmented
        value={basis}
        onChange={onBasis}
        options={[
          { value: "month", label: "Per month" },
          { value: "day", label: "Per day" },
        ]}
      />
      <View className="-mb-5 mt-2.5">
        <Field
          showLabel={false}
          label={basis === "day" ? "Salary for one day" : "Salary for the month"}
          prefix="₹"
          value={salaryText}
          onChangeText={(text) => onSalaryText(text.replace(/[^\d,]/g, ""))}
          keyboardType="number-pad"
          placeholder={basis === "day" ? "600" : "16,000"}
          suffix={
            <AppText tone="ink3" size="sm" className="pr-3">
              {basis === "day" ? "a day" : "a month"}
            </AppText>
          }
          error={error}
          hint={payLine(salary, basis)}
        />
      </View>
    </View>
  );
}

export function WorkingDaysField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View className="mb-5">
      <AppText variant="bold" size="base" className="mb-2">
        Working days in a month
      </AppText>
      <Stepper label="Working days in a month" value={value} min={1} max={31} onChange={onChange} />
      <Hint>Days you expect them to work. 26 if Sunday is off.</Hint>
    </View>
  );
}

export function DaysWorkedField({
  value,
  max,
  onChange,
  error,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  error?: string | null;
}) {
  return (
    <View className="mb-5">
      <AppText variant="bold" size="base" className="mb-2">
        Days already worked this month
      </AppText>
      <Stepper label="Days already worked this month" value={value} min={0} max={max} onChange={onChange} error={Boolean(error)} />
      {error ? <ErrorLine message={error} /> : <Hint>Days they came before you added them. 0 if they start today.</Hint>}
    </View>
  );
}
