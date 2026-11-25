export type SalaryBasis = "month" | "day";

export function amountPayable(input: {
  salary: number;
  salaryBasis: SalaryBasis;
  workingDays: number;
  daysWorked: number;
}): number {
  const raw =
    input.salaryBasis === "day"
      ? input.salary * input.daysWorked
      : (input.salary / input.workingDays) * input.daysWorked;
  return roundMoney(raw);
}

export function settlePay(
  input: {
    salary: number;
    salaryBasis: SalaryBasis;
    workingDays: number;
    daysWorked: number;
  },
  given: number,
): { earned: number; given: number; payable: number } {
  const earned = amountPayable(input);
  const givenAmount = roundMoney(given);
  return { earned, given: givenAmount, payable: roundMoney(earned - givenAmount) };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
