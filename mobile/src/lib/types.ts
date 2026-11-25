/** JSON returned by the Express API. */

export type Health = {
  ok: boolean;
  store: "memory" | "supabase";
};

export type Admin = {
  id: string;
  email: string;
  name: string;
};

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  admin: Admin;
};

export type OrganisationProfile = {
  name: string;
  industry: string;
  description: string;
  country: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
  contactName: string;
  phone: string;
  email: string;
};

export type Organisation = OrganisationProfile & {
  id: string;
  ownerId: string;
  createdAt: string;
};

export type OrganisationSummary = Organisation & {
  employeeCount: number;
};

export type SalaryBasis = "month" | "day";

export type EmployeeSettings = {
  workingDays: number;
  salary: number;
  salaryBasis: SalaryBasis;
  joinedOn: string;
};

/** What is sent when adding a person. daysWorked is the days they came this month before being added. */
export type NewEmployee = EmployeeSettings & {
  name: string;
  role: string;
  daysWorked: number;
};

/** Pay for one month. daysPresent counts every day; daysWorked is what is paid (capped for a monthly salary). */
export type Settlement = {
  daysPresent: number;
  daysWorked: number;
  earned: number;
  given: number;
  payable: number;
};

export type Employee = EmployeeSettings & Settlement & {
  id: string;
  organisationId: string;
  name: string;
  role: string;
  createdAt: string;
};

export type Advance = {
  id: string;
  organisationId: string;
  employeeId: string;
  amount: number;
  givenOn: string;
  createdAt: string;
};

export type AdvanceLedger = {
  month: string;
  earned: number;
  given: number;
  payable: number;
  advances: Advance[];
};

export type OrganisationDetail = Organisation & {
  employees: Employee[];
};

export type AttendanceEmployee = {
  id: string;
  name: string;
  role: string;
  joinedOn: string;
  present: boolean;
};

export type AttendanceDay = {
  date: string;
  employees: AttendanceEmployee[];
};

export type EmployeeMonth = Settlement & {
  month: string;
  joinedOn: string;
  workingDays: number;
  presentDates: string[];
};
