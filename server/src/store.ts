import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { currentMonthKey, daysInMonth, monthEnd } from "./dates";
import { settlePay, type SalaryBasis } from "./pay";

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

export type EmployeeSettings = {
  workingDays: number;
  salary: number;
  salaryBasis: SalaryBasis;
  joinedOn: string;
};

export type EmployeeInput = EmployeeSettings & {
  name: string;
  role: string;
  /** Days they came this month before they were added. Counted only in the month they were added. */
  daysWorked: number;
};

/** One month of pay. `daysPresent` is every counted day; `daysWorked` is what is paid (capped for a monthly salary). */
export type Settlement = {
  daysPresent: number;
  daysWorked: number;
  earned: number;
  given: number;
  payable: number;
};

export type Employee = EmployeeSettings &
  Settlement & {
    id: string;
    organisationId: string;
    name: string;
    role: string;
    createdAt: string;
  };

/** What is stored for a person. Pay is always worked out from attendance and money given for a month. */
type EmployeeRecord = EmployeeSettings & {
  id: string;
  organisationId: string;
  name: string;
  role: string;
  createdAt: string;
  daysBeforeApp: number;
  addedInMonth: string;
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

/**
 * Pay for one month, from the days marked present that month (plus the days entered when the
 * person was added, if this is that month) and the money given that month.
 * A monthly salary pays at most the working days; a day wage pays every day present.
 */
export function settleMonth(record: EmployeeRecord, month: string, marks: number, given: number): Settlement {
  const before = record.addedInMonth === month ? record.daysBeforeApp : 0;
  const daysPresent = Math.min(marks + before, daysInMonth(month));
  const daysWorked = record.salaryBasis === "month" ? Math.min(daysPresent, record.workingDays) : daysPresent;
  return { daysPresent, daysWorked, ...settlePay({ ...record, daysWorked }, given) };
}

function toEmployee(record: EmployeeRecord, month: string, marks: number, given: number): Employee {
  const { daysBeforeApp: _before, addedInMonth: _added, ...base } = record;
  return { ...base, ...settleMonth(record, month, marks, given) };
}

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

export type AttendanceResult = AttendanceDay | "missing-organisation" | "missing-employee" | "before-joining";

export type EmployeeMonth = Settlement & {
  month: string;
  joinedOn: string;
  workingDays: number;
  presentDates: string[];
};

export type Store = {
  kind: "memory" | "supabase";
  /** Throws when the database cannot answer a trivial query. */
  ping(): Promise<void>;
  listOrganisations(ownerId: string): Promise<OrganisationSummary[]>;
  getOrganisation(id: string): Promise<Organisation | null>;
  createOrganisation(ownerId: string, profile: OrganisationProfile): Promise<Organisation>;
  updateOrganisation(id: string, profile: OrganisationProfile): Promise<Organisation | null>;
  listEmployees(organisationId: string): Promise<Employee[]>;
  createEmployee(organisationId: string, input: EmployeeInput): Promise<Employee | null>;
  updateEmployee(organisationId: string, employeeId: string, input: EmployeeSettings): Promise<Employee | null>;
  getAttendance(organisationId: string, date: string): Promise<AttendanceDay | null>;
  getEmployeeMonth(organisationId: string, employeeId: string, month: string): Promise<EmployeeMonth | null>;
  setAttendance(organisationId: string, date: string, employeeIds: string[]): Promise<AttendanceResult>;
  getAdvances(organisationId: string, employeeId: string): Promise<AdvanceLedger | null>;
  addAdvance(
    organisationId: string,
    employeeId: string,
    input: { amount: number; givenOn: string },
  ): Promise<AdvanceLedger | "missing" | "before-joining" | "outside-month">;
  removeAdvance(organisationId: string, employeeId: string, advanceId: string): Promise<AdvanceLedger | null>;
};

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

function inMonth(isoDate: string, month: string): boolean {
  return isoDate >= `${month}-01` && isoDate <= monthEnd(month);
}

function inCurrentMonth(isoDate: string): boolean {
  const key = currentMonthKey();
  return isoDate >= `${key}-01` && isoDate <= monthEnd(key);
}

function memoryStore(): Store {
  const organisations: Organisation[] = [];
  const employees: EmployeeRecord[] = [];
  const attendance: { organisationId: string; employeeId: string; workDate: string }[] = [];
  const advances: Advance[] = [];

  function givenIn(employeeId: string, month: string): number {
    return advances
      .filter((advance) => advance.employeeId === employeeId && inMonth(advance.givenOn, month))
      .reduce((total, advance) => total + advance.amount, 0);
  }

  function marksIn(record: EmployeeRecord, month: string): string[] {
    return attendance
      .filter((mark) => mark.employeeId === record.id && inMonth(mark.workDate, month) && mark.workDate >= record.joinedOn)
      .map((mark) => mark.workDate)
      .sort();
  }

  function present(record: EmployeeRecord, month = currentMonthKey()): Employee {
    return toEmployee(record, month, marksIn(record, month).length, givenIn(record.id, month));
  }

  function ledger(record: EmployeeRecord): AdvanceLedger {
    const month = currentMonthKey();
    const settled = present(record, month);
    return {
      month,
      earned: settled.earned,
      given: settled.given,
      payable: settled.payable,
      advances: advances
        .filter((advance) => advance.employeeId === record.id && inMonth(advance.givenOn, month))
        .sort((a, b) => (a.givenOn < b.givenOn ? 1 : a.givenOn > b.givenOn ? -1 : b.createdAt.localeCompare(a.createdAt))),
    };
  }

  function attendanceDay(organisationId: string, date: string): AttendanceDay {
    const marked = new Set(
      attendance
        .filter((mark) => mark.organisationId === organisationId && mark.workDate === date)
        .map((mark) => mark.employeeId),
    );
    return {
      date,
      employees: employees
        .filter((employee) => employee.organisationId === organisationId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          role: employee.role,
          joinedOn: employee.joinedOn,
          present: marked.has(employee.id),
        })),
    };
  }

  function find(organisationId: string, employeeId: string): EmployeeRecord | undefined {
    return employees.find((item) => item.id === employeeId && item.organisationId === organisationId);
  }

  return {
    kind: "memory",
    async ping() {},
    async listOrganisations(ownerId) {
      return organisations
        .filter((organisation) => organisation.ownerId === ownerId)
        .map((organisation) => ({
          ...organisation,
          employeeCount: employees.filter((employee) => employee.organisationId === organisation.id).length,
        }))
        .sort(byNewest);
    },
    async getOrganisation(id) {
      return organisations.find((organisation) => organisation.id === id) ?? null;
    },
    async createOrganisation(ownerId, profile) {
      const organisation: Organisation = {
        ...profile,
        id: randomUUID(),
        ownerId,
        createdAt: new Date().toISOString(),
      };
      organisations.push(organisation);
      return organisation;
    },
    async updateOrganisation(id, profile) {
      const index = organisations.findIndex((organisation) => organisation.id === id);
      if (index < 0) return null;
      organisations[index] = { ...organisations[index], ...profile };
      return organisations[index];
    },
    async listEmployees(organisationId) {
      return employees
        .filter((employee) => employee.organisationId === organisationId)
        .map((employee) => present(employee))
        .sort(byNewest);
    },
    async createEmployee(organisationId, input) {
      if (!organisations.some((organisation) => organisation.id === organisationId)) return null;
      const record: EmployeeRecord = {
        id: randomUUID(),
        organisationId,
        name: input.name,
        role: input.role,
        workingDays: input.workingDays,
        salary: input.salary,
        salaryBasis: input.salaryBasis,
        joinedOn: input.joinedOn,
        daysBeforeApp: input.daysWorked,
        addedInMonth: currentMonthKey(),
        createdAt: new Date().toISOString(),
      };
      employees.push(record);
      return present(record);
    },
    async updateEmployee(organisationId, employeeId, input) {
      const index = employees.findIndex((item) => item.id === employeeId && item.organisationId === organisationId);
      const current = employees[index];
      if (!current) return null;
      employees[index] = {
        ...current,
        workingDays: input.workingDays,
        salary: input.salary,
        salaryBasis: input.salaryBasis,
        joinedOn: input.joinedOn,
      };
      return present(employees[index]);
    },
    async getAttendance(organisationId, date) {
      if (!organisations.some((organisation) => organisation.id === organisationId)) return null;
      return attendanceDay(organisationId, date);
    },
    async getEmployeeMonth(organisationId, employeeId, month) {
      const record = find(organisationId, employeeId);
      if (!record) return null;
      const presentDates = marksIn(record, month);
      return {
        month,
        joinedOn: record.joinedOn,
        workingDays: record.workingDays,
        presentDates,
        ...settleMonth(record, month, presentDates.length, givenIn(record.id, month)),
      };
    },
    async setAttendance(organisationId, date, employeeIds) {
      if (!organisations.some((organisation) => organisation.id === organisationId)) return "missing-organisation";
      const people = employees.filter((employee) => employee.organisationId === organisationId);
      const chosen = new Set(employeeIds);
      for (const id of chosen) {
        const employee = people.find((person) => person.id === id);
        if (!employee) return "missing-employee";
        if (date < employee.joinedOn) return "before-joining";
      }
      for (let index = attendance.length - 1; index >= 0; index -= 1) {
        const mark = attendance[index];
        if (mark.organisationId === organisationId && mark.workDate === date) attendance.splice(index, 1);
      }
      for (const employeeId of chosen) attendance.push({ organisationId, employeeId, workDate: date });
      return attendanceDay(organisationId, date);
    },
    async getAdvances(organisationId, employeeId) {
      const record = find(organisationId, employeeId);
      return record ? ledger(record) : null;
    },
    async addAdvance(organisationId, employeeId, input) {
      const record = find(organisationId, employeeId);
      if (!record) return "missing";
      if (!inCurrentMonth(input.givenOn)) return "outside-month";
      if (input.givenOn < record.joinedOn) return "before-joining";
      advances.push({
        id: randomUUID(),
        organisationId,
        employeeId,
        amount: input.amount,
        givenOn: input.givenOn,
        createdAt: new Date().toISOString(),
      });
      return ledger(record);
    },
    async removeAdvance(organisationId, employeeId, advanceId) {
      const record = find(organisationId, employeeId);
      const index = advances.findIndex(
        (advance) => advance.id === advanceId && advance.employeeId === employeeId && advance.organisationId === organisationId,
      );
      if (!record || index < 0) return null;
      advances.splice(index, 1);
      return ledger(record);
    },
  };
}

type OrganisationRow = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  owner_id: string | null;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  organisation_id: string;
  name: string;
  role: string;
  working_days: number;
  days_before_app?: number | null;
  added_in_month?: string | null;
  total_pay: number | string;
  salary_basis: SalaryBasis;
  joined_on: string;
  created_at: string;
};

function fromOrganisation(row: OrganisationRow): Organisation {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry ?? "",
    description: row.description ?? "",
    country: row.country ?? "",
    state: row.state ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    postalCode: row.postal_code ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    ownerId: row.owner_id ?? "",
    createdAt: row.created_at,
  };
}

function organisationColumns(profile: OrganisationProfile) {
  return {
    name: profile.name,
    industry: profile.industry,
    description: profile.description,
    country: profile.country,
    state: profile.state,
    city: profile.city,
    address: profile.address,
    postal_code: profile.postalCode,
    contact_name: profile.contactName,
    phone: profile.phone,
    email: profile.email,
  };
}

function fromEmployee(row: EmployeeRow): EmployeeRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    role: row.role,
    workingDays: row.working_days,
    salary: Number(row.total_pay),
    salaryBasis: row.salary_basis,
    joinedOn: row.joined_on,
    daysBeforeApp: row.days_before_app ?? 0,
    addedInMonth: row.added_in_month ?? "",
    createdAt: row.created_at,
  };
}

function supabaseStore(client: SupabaseClient): Store {
  return {
    kind: "supabase",
    async ping() {
      const { error } = await client.from("organisations").select("id", { head: true }).limit(1);
      if (error) throw error;
    },
    async listOrganisations(ownerId) {
      const { data: organisationData, error: organisationError } = await client
        .from("organisations")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (organisationError) throw organisationError;
      const rows = (organisationData ?? []) as OrganisationRow[];
      if (rows.length === 0) return [];
      const { data: employeeData, error: employeeError } = await client
        .from("employees")
        .select("organisation_id")
        .in(
          "organisation_id",
          rows.map((row) => row.id),
        );
      if (employeeError) throw employeeError;
      const counts = new Map<string, number>();
      for (const row of (employeeData ?? []) as { organisation_id: string }[]) {
        counts.set(row.organisation_id, (counts.get(row.organisation_id) ?? 0) + 1);
      }
      return rows.map((row) => ({
        ...fromOrganisation(row),
        employeeCount: counts.get(row.id) ?? 0,
      }));
    },
    async getOrganisation(id) {
      const { data, error } = await client.from("organisations").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? fromOrganisation(data as OrganisationRow) : null;
    },
    async createOrganisation(ownerId, profile) {
      const { data, error } = await client
        .from("organisations")
        .insert({ ...organisationColumns(profile), owner_id: ownerId })
        .select("*")
        .single();
      if (error) throw error;
      return fromOrganisation(data as OrganisationRow);
    },
    async updateOrganisation(id, profile) {
      const { data, error } = await client
        .from("organisations")
        .update(organisationColumns(profile))
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? fromOrganisation(data as OrganisationRow) : null;
    },
    async listEmployees(organisationId) {
      const { data, error } = await client
        .from("employees")
        .select("*")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const month = currentMonthKey();
      const records = (data as EmployeeRow[]).map(fromEmployee);
      const totals = await monthTotals(client, organisationId, month);
      return records.map((record) => settleFromTotals(record, month, totals));
    },
    async createEmployee(organisationId, input) {
      const organisation = await this.getOrganisation(organisationId);
      if (!organisation) return null;
      const month = currentMonthKey();
      const { data, error } = await client
        .from("employees")
        .insert({
          organisation_id: organisationId,
          name: input.name,
          role: input.role,
          working_days: input.workingDays,
          days_before_app: input.daysWorked,
          added_in_month: month,
          total_pay: input.salary,
          salary_basis: input.salaryBasis,
          joined_on: input.joinedOn,
        })
        .select("*")
        .single();
      if (error) throw error;
      return toEmployee(fromEmployee(data as EmployeeRow), month, 0, 0);
    },
    async updateEmployee(organisationId, employeeId, input) {
      const { data, error } = await client
        .from("employees")
        .update({
          working_days: input.workingDays,
          total_pay: input.salary,
          salary_basis: input.salaryBasis,
          joined_on: input.joinedOn,
        })
        .eq("id", employeeId)
        .eq("organisation_id", organisationId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const month = currentMonthKey();
      const totals = await monthTotals(client, organisationId, month, employeeId);
      return settleFromTotals(fromEmployee(data as EmployeeRow), month, totals);
    },
    async getAttendance(organisationId, date) {
      const organisation = await this.getOrganisation(organisationId);
      if (!organisation) return null;
      return attendanceDay(client, organisationId, date);
    },
    async getEmployeeMonth(organisationId, employeeId, month) {
      const record = await employeeRecord(client, organisationId, employeeId);
      if (!record) return null;
      const totals = await monthTotals(client, organisationId, month, employeeId);
      const presentDates = datesFor(record, totals);
      return {
        month,
        joinedOn: record.joinedOn,
        workingDays: record.workingDays,
        presentDates,
        ...settleMonth(record, month, presentDates.length, totals.given.get(record.id) ?? 0),
      };
    },
    async setAttendance(organisationId, date, employeeIds) {
      const organisation = await this.getOrganisation(organisationId);
      if (!organisation) return "missing-organisation";
      const { data: peopleData, error: peopleError } = await client
        .from("employees")
        .select("id, joined_on")
        .eq("organisation_id", organisationId);
      if (peopleError) throw peopleError;
      const people = (peopleData ?? []) as { id: string; joined_on: string }[];
      const chosen = [...new Set(employeeIds)];
      for (const id of chosen) {
        const employee = people.find((person) => person.id === id);
        if (!employee) return "missing-employee";
        if (date < employee.joined_on) return "before-joining";
      }

      // Add the chosen marks first, then remove only the people who are no longer chosen.
      // If either step fails, the day keeps its earlier marks: it is never left empty.
      // Upsert also lets two saves of the same day run at once without a duplicate-key error.
      if (chosen.length > 0) {
        const added = await client.from("attendance").upsert(
          chosen.map((employeeId) => ({
            organisation_id: organisationId,
            employee_id: employeeId,
            work_date: date,
          })),
          { onConflict: "employee_id,work_date", ignoreDuplicates: true },
        );
        if (added.error) throw added.error;
      }
      let removal = client.from("attendance").delete().eq("organisation_id", organisationId).eq("work_date", date);
      if (chosen.length > 0) removal = removal.not("employee_id", "in", `(${chosen.join(",")})`);
      const removed = await removal;
      if (removed.error) throw removed.error;

      return attendanceDay(client, organisationId, date);
    },
    async getAdvances(organisationId, employeeId) {
      return advanceLedger(client, organisationId, employeeId);
    },
    async addAdvance(organisationId, employeeId, input) {
      const record = await employeeRecord(client, organisationId, employeeId);
      if (!record) return "missing";
      if (!inCurrentMonth(input.givenOn)) return "outside-month";
      if (input.givenOn < record.joinedOn) return "before-joining";
      const inserted = await client.from("advances").insert({
        organisation_id: organisationId,
        employee_id: employeeId,
        amount: input.amount,
        given_on: input.givenOn,
      });
      if (inserted.error) throw inserted.error;
      const ledger = await advanceLedger(client, organisationId, employeeId);
      if (!ledger) return "missing";
      return ledger;
    },
    async removeAdvance(organisationId, employeeId, advanceId) {
      const existing = await client
        .from("advances")
        .select("id")
        .eq("id", advanceId)
        .eq("organisation_id", organisationId)
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) return null;
      const removed = await client.from("advances").delete().eq("id", advanceId);
      if (removed.error) throw removed.error;
      return advanceLedger(client, organisationId, employeeId);
    },
  };
}

async function attendanceDay(client: SupabaseClient, organisationId: string, date: string): Promise<AttendanceDay> {
  const [{ data: people, error: peopleError }, { data: marks, error: marksError }] = await Promise.all([
    client.from("employees").select("id, name, role, joined_on").eq("organisation_id", organisationId).order("name"),
    client.from("attendance").select("employee_id").eq("organisation_id", organisationId).eq("work_date", date),
  ]);
  if (peopleError) throw peopleError;
  if (marksError) throw marksError;
  const present = new Set(((marks ?? []) as { employee_id: string }[]).map((mark) => mark.employee_id));
  return {
    date,
    employees: ((people ?? []) as { id: string; name: string; role: string; joined_on: string }[]).map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      joinedOn: person.joined_on,
      present: present.has(person.id),
    })),
  };
}

type MonthTotals = {
  /** Dates marked present in the month, per employee, oldest first. */
  dates: Map<string, string[]>;
  /** Money given in the month, per employee. */
  given: Map<string, number>;
};

/** Attendance and money given for one month, for the whole organisation or one person. */
async function monthTotals(
  client: SupabaseClient,
  organisationId: string,
  month: string,
  employeeId?: string,
): Promise<MonthTotals> {
  const start = `${month}-01`;
  const end = monthEnd(month);
  let marksQuery = client
    .from("attendance")
    .select("employee_id, work_date")
    .eq("organisation_id", organisationId)
    .gte("work_date", start)
    .lte("work_date", end);
  let givenQuery = client
    .from("advances")
    .select("employee_id, amount")
    .eq("organisation_id", organisationId)
    .gte("given_on", start)
    .lte("given_on", end);
  if (employeeId) {
    marksQuery = marksQuery.eq("employee_id", employeeId);
    givenQuery = givenQuery.eq("employee_id", employeeId);
  }
  const [marks, given] = await Promise.all([marksQuery.order("work_date"), givenQuery]);
  if (marks.error) throw marks.error;
  if (given.error) throw given.error;
  const dates = new Map<string, string[]>();
  for (const row of (marks.data ?? []) as { employee_id: string; work_date: string }[]) {
    const list = dates.get(row.employee_id) ?? [];
    list.push(row.work_date);
    dates.set(row.employee_id, list);
  }
  const totals = new Map<string, number>();
  for (const row of (given.data ?? []) as { employee_id: string; amount: number | string }[]) {
    totals.set(row.employee_id, (totals.get(row.employee_id) ?? 0) + Number(row.amount));
  }
  return { dates, given: totals };
}

/** Days marked present on or after the joining date. */
function datesFor(record: EmployeeRecord, totals: MonthTotals): string[] {
  return (totals.dates.get(record.id) ?? []).filter((date) => date >= record.joinedOn);
}

function settleFromTotals(record: EmployeeRecord, month: string, totals: MonthTotals): Employee {
  return toEmployee(record, month, datesFor(record, totals).length, totals.given.get(record.id) ?? 0);
}

async function employeeRecord(client: SupabaseClient, organisationId: string, employeeId: string): Promise<EmployeeRecord | null> {
  const { data, error } = await client
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromEmployee(data as EmployeeRow) : null;
}

async function advanceLedger(client: SupabaseClient, organisationId: string, employeeId: string): Promise<AdvanceLedger | null> {
  const record = await employeeRecord(client, organisationId, employeeId);
  if (!record) return null;
  const key = currentMonthKey();
  const [{ data, error }, totals] = await Promise.all([
    client
      .from("advances")
      .select("*")
      .eq("organisation_id", organisationId)
      .eq("employee_id", employeeId)
      .gte("given_on", `${key}-01`)
      .lte("given_on", monthEnd(key))
      .order("given_on", { ascending: false })
      .order("created_at", { ascending: false }),
    monthTotals(client, organisationId, key, employeeId),
  ]);
  if (error) throw error;
  const advances = ((data ?? []) as AdvanceRow[]).map(fromAdvance);
  const given = advances.reduce((total, advance) => total + advance.amount, 0);
  const settled = settleMonth(record, key, datesFor(record, totals).length, given);
  return {
    month: key,
    earned: settled.earned,
    given: settled.given,
    payable: settled.payable,
    advances,
  };
}

type AdvanceRow = {
  id: string;
  organisation_id: string;
  employee_id: string;
  amount: number | string;
  given_on: string;
  created_at: string;
};

function fromAdvance(row: AdvanceRow): Advance {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    employeeId: row.employee_id,
    amount: Number(row.amount),
    givenOn: row.given_on,
    createdAt: row.created_at,
  };
}

export function createStore(): Store {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!url && !key) return memoryStore();
  if (!key) {
    console.warn("SUPABASE_URL is set and SUPABASE_SERVICE_ROLE_KEY is empty. Records stay in memory.");
    return memoryStore();
  }
  if (!url) {
    throw new Error("Set SUPABASE_URL together with SUPABASE_SERVICE_ROLE_KEY.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseStore(client);
}
