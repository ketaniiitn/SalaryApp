import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { createBillingRouter } from "../../billing/src/routes";
import { isIndianState } from "../../billing/src/states";
import { createBillingStore } from "../../billing/src/store";
import { AuthError, createAuth, createMemoryAuth, type Admin } from "./auth";
import { clientIp, rateLimit } from "./rate-limit";
import { currentMonthKey, latestAllowedDate, monthEnd } from "./dates";
import { createStore } from "./store";

dotenv.config({ path: ".env.local" });
dotenv.config();

const production = process.env.NODE_ENV === "production";
export const store = createStore();
const billing = createBillingStore();
// Without Supabase keys, records stay in memory and so do accounts, so the API is usable for local development.
export const auth = createAuth() ?? (store.kind === "memory" ? createMemoryAuth() : null);
if (production && (store.kind !== "supabase" || billing.kind !== "supabase" || !auth)) {
  throw new Error("NODE_ENV=production needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Refusing to start with in-memory records.");
}
export const app = express();

// Behind a host's proxy, req.ip is the proxy unless this is set, and every phone would share one sign-in limit.
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// The Android app sends no Origin header, so this list only limits browsers.
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: "1mb" }));

const organisationSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the workplace name.").max(80, "Keep the name under 80 letters."),
    industry: z.string().trim().min(1, "Choose what kind of work this is.").max(80, "Keep the type of work under 80 letters."),
    description: z.string().trim().max(280, "Keep the description under 280 letters."),
    country: z.string().trim().min(1, "Choose a country.").max(60, "Keep the country under 60 letters."),
    state: z.string().trim().min(1, "Choose a state.").max(80, "Keep the state under 80 letters."),
    city: z.string().trim().min(1, "Enter the city.").max(80, "Keep the city under 80 letters."),
    address: z.string().trim().min(1, "Enter the address.").max(240, "Keep the address under 240 letters."),
    postalCode: z.string().trim().max(12, "Keep the postal code under 12 characters."),
    contactName: z.string().trim().min(1, "Enter the owner's name.").max(80, "Keep the name under 80 letters."),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a phone number.")
      .max(20, "That phone number is too long.")
      .refine((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15;
      }, "Enter a phone number we can call."),
    email: z
      .string()
      .trim()
      .max(200, "Email is too long.")
      .refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter a valid email."),
  })
  .superRefine((value, context) => {
    if (value.country === "India" && !isIndianState(value.state)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a state in India.", path: ["state"] });
    }
    if (value.country === "India" && value.postalCode !== "" && !/^\d{6}$/.test(value.postalCode)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a 6-digit PIN code.", path: ["postalCode"] });
    }
  });

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Password is too long.");

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email.").max(200, "Email is too long."),
  password: passwordSchema,
});

const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Sign in to continue."),
});

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const employeeSettingsObject = z.object({
    workingDays: z
      .number({ required_error: "Enter the working days in the month.", invalid_type_error: "Enter the working days in the month." })
      .int("Working days must be a whole number.")
      .min(1, "Enter at least 1 working day.")
      .max(31, "Working days cannot be more than 31."),
    salary: z
      .number({ required_error: "Enter the salary.", invalid_type_error: "Enter the salary." })
      .positive("Enter the salary.")
      .max(99999999.99, "Salary is too large.")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places."),
    salaryBasis: z.enum(["month", "day"], {
      required_error: "Choose per month or per day.",
      invalid_type_error: "Choose per month or per day.",
    }),
    joinedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a joining date like 2026-11-20.")
      .refine(isRealDate, "That joining date is not a real date."),
});

/** A monthly salary pays at most the working days. A day wage pays every day present. */
function daysWithinMonth(
  value: { daysWorked: number; workingDays: number; salaryBasis: "month" | "day" },
  context: z.RefinementCtx,
) {
  if (value.salaryBasis === "month" && value.daysWorked > value.workingDays) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Days worked cannot be more than the working days in the month.",
      path: ["daysWorked"],
    });
  }
}

// Days worked are never set directly after adding a person: they come from attendance.
// Any daysWorked an older app sends here is dropped by zod.
const employeeSettingsSchema = employeeSettingsObject;

const advanceSchema = z.object({
  amount: z
    .number({ required_error: "Enter the amount given.", invalid_type_error: "Enter the amount given." })
    .positive("Enter the amount given.")
    .max(99999999.99, "That amount is too large.")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places."),
  givenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20.")
    .refine(isRealDate, "That date is not a real date.")
    .refine((value) => {
      const month = currentMonthKey();
      return value >= `${month}-01` && value <= monthEnd(month) && value <= latestAllowedDate();
    }, "Choose a day in this month, up to today."),
});

const attendanceSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20.")
    .refine(isRealDate, "That date is not a real date.")
    .refine((value) => value <= latestAllowedDate(), "Choose today or an earlier date."),
  employeeIds: z.array(z.string().uuid("That employee was not found.")),
});

const employeeSchema = employeeSettingsObject
  .extend({
    name: z.string().trim().min(1, "Enter an employee name.").max(80, "Employee name is too long."),
    role: z.string().trim().min(1, "Enter a role.").max(80, "Role is too long."),
    // Days they came this month before they were added.
    daysWorked: z
      .number({ required_error: "Enter the days worked.", invalid_type_error: "Enter the days worked." })
      .int("Days worked must be a whole number.")
      .min(0, "Days worked cannot be negative.")
      .max(31, "Days worked cannot be more than 31."),
  })
  .superRefine(daysWithinMonth);

function databaseError(res: express.Response, error: unknown) {
  console.error(error);
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (message.includes("industry") || message.includes("contact_name") || message.includes("postal_code")) {
    res.status(500).json({
      error: "Workplace details are missing. Run supabase/organisation-profile.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (message.includes("owner_id")) {
    res.status(500).json({
      error: "Organisation owners are missing. Run supabase/auth.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (message.includes("days_before_app") || message.includes("added_in_month")) {
    res.status(500).json({
      error: "Pay by month is not set up yet. Run supabase/pay-by-month.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (message.includes("advances")) {
    res.status(500).json({
      error: "The money-given table is missing. Run supabase/advances.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (message.includes("attendance")) {
    res.status(500).json({
      error: "The attendance table is missing. Run supabase/attendance.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (code === "PGRST204" || code === "42703") {
    res.status(500).json({
      error: "Employee pay settings are missing. Run supabase/employee-settings.sql in the Supabase SQL editor.",
    });
    return;
  }
  if (code === "PGRST205" || code === "42P01") {
    res.status(500).json({
      error: "The organisations and employees tables are missing. Run supabase/schema.sql in the Supabase SQL editor.",
    });
    return;
  }
  res.status(500).json({ error: "The database request failed." });
}

app.get("/", (_req, res) => {
  res
    .type("text")
    .send("Salary API is running. The app uses /health, /api/organisations, and /api/organisations/:id/employees.");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, store: store.kind });
});

app.get("/health/db", async (_req, res) => {
  try {
    await store.ping();
    res.json({ ok: true, store: store.kind });
  } catch (error) {
    console.error(error);
    res.status(503).json({ ok: false, store: store.kind, error: "The database did not answer." });
  }
});

function authUnavailable(res: express.Response): boolean {
  if (auth) return false;
  res.status(503).json({ error: "Sign-in needs the Supabase keys on the server." });
  return true;
}

function bearerToken(req: express.Request): string {
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (authUnavailable(res) || !auth) return;
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const admin = await auth.adminFromToken(token);
    if (!admin) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    res.locals.admin = admin;
    next();
  } catch (error) {
    databaseError(res, error);
  }
}

function currentAdmin(res: express.Response): Admin {
  return res.locals.admin as Admin;
}

// Limits on sign-in. Supabase limits by IP too, but it only ever sees this server's IP,
// so without these one person guessing passwords could lock everyone out.
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const signupLimit = rateLimit({ name: "signup", limit: 5, windowMs: 60 * 60 * 1000, key: clientIp });
const loginByIp = rateLimit({ name: "login-ip", limit: 20, windowMs: FIFTEEN_MINUTES, key: clientIp });
const loginByEmail = rateLimit({
  name: "login-email",
  limit: 10,
  windowMs: FIFTEEN_MINUTES,
  key: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return email ? `email:${email}` : null;
  },
});
const refreshLimit = rateLimit({ name: "refresh", limit: 60, windowMs: FIFTEEN_MINUTES, key: clientIp });

app.post("/api/auth/signup", signupLimit, async (req, res) => {
  if (authUnavailable(res) || !auth) return;
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the account fields." });
    return;
  }
  try {
    res.status(201).json(await auth.signup(parsed.data));
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status === 422 ? 409 : error.status).json({ error: error.message });
      return;
    }
    databaseError(res, error);
  }
});

app.post("/api/auth/login", loginByIp, loginByEmail, async (req, res) => {
  if (authUnavailable(res) || !auth) return;
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the email and password." });
    return;
  }
  try {
    res.json(await auth.login(parsed.data));
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status >= 500 ? 502 : 401).json({ error: error.message });
      return;
    }
    databaseError(res, error);
  }
});

app.post("/api/auth/refresh", refreshLimit, async (req, res) => {
  if (authUnavailable(res) || !auth) return;
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    res.json(await auth.refresh(parsed.data.refreshToken));
  } catch (error) {
    if (error instanceof AuthError) {
      // An outage at the sign-in service is not a bad token: say so, so the phone keeps the session.
      if (error.status >= 500) {
        res.status(502).json({ error: "The sign-in service did not respond. Try again in a moment." });
        return;
      }
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    databaseError(res, error);
  }
});

app.post("/api/auth/logout", async (req, res) => {
  if (!auth) {
    res.status(204).end();
    return;
  }
  const token = bearerToken(req);
  if (token) {
    try {
      await auth.logout(token);
    } catch (error) {
      if (!(error instanceof AuthError)) {
        databaseError(res, error);
        return;
      }
    }
  }
  res.status(204).end();
});

app.use("/api/organisations", requireAdmin);

app.get("/api/organisations", async (_req, res) => {
  try {
    res.json(await store.listOrganisations(currentAdmin(res).id));
  } catch (error) {
    databaseError(res, error);
  }
});

app.post("/api/organisations", async (req, res) => {
  const parsed = organisationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the organisation fields." });
    return;
  }

  try {
    const organisation = await store.createOrganisation(currentAdmin(res).id, parsed.data);
    res.status(201).json(organisation);
  } catch (error) {
    databaseError(res, error);
  }
});

app.use("/api/organisations/:id", async (req, res, next) => {
  try {
    const organisation = await store.getOrganisation(req.params.id);
    if (!organisation || organisation.ownerId !== currentAdmin(res).id) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    next();
  } catch (error) {
    databaseError(res, error);
  }
});

app.patch("/api/organisations/:id", async (req, res) => {
  const parsed = organisationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the workplace fields." });
    return;
  }
  try {
    const organisation = await store.updateOrganisation(req.params.id, parsed.data);
    if (!organisation) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    res.json(organisation);
  } catch (error) {
    databaseError(res, error);
  }
});

app.get("/api/organisations/:id", async (req, res) => {
  try {
    const organisation = await store.getOrganisation(req.params.id);
    if (!organisation) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    const employees = await store.listEmployees(organisation.id);
    res.json({ ...organisation, employees });
  } catch (error) {
    databaseError(res, error);
  }
});

app.get("/api/organisations/:id/employees", async (req, res) => {
  try {
    const organisation = await store.getOrganisation(req.params.id);
    if (!organisation) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    res.json(await store.listEmployees(organisation.id));
  } catch (error) {
    databaseError(res, error);
  }
});

app.post("/api/organisations/:id/employees", async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the employee fields." });
    return;
  }

  try {
    const employee = await store.createEmployee(req.params.id, parsed.data);
    if (!employee) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    res.status(201).json(employee);
  } catch (error) {
    databaseError(res, error);
  }
});

app.get("/api/organisations/:id/employees/:employeeId/attendance", async (req, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    res.status(400).json({ error: "Choose a month." });
    return;
  }

  try {
    const record = await store.getEmployeeMonth(req.params.id, req.params.employeeId, month);
    if (!record) {
      res.status(404).json({ error: "That employee was not found." });
      return;
    }
    res.json(record);
  } catch (error) {
    databaseError(res, error);
  }
});

app.get("/api/organisations/:id/attendance", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : "";
  const parsed = attendanceSchema.shape.date.safeParse(date);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Choose a date." });
    return;
  }

  try {
    const day = await store.getAttendance(req.params.id, parsed.data);
    if (!day) {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    res.json(day);
  } catch (error) {
    databaseError(res, error);
  }
});

app.put("/api/organisations/:id/attendance", async (req, res) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the attendance." });
    return;
  }

  try {
    const result = await store.setAttendance(req.params.id, parsed.data.date, parsed.data.employeeIds);
    if (result === "missing-organisation") {
      res.status(404).json({ error: "That organisation was not found." });
      return;
    }
    if (result === "missing-employee") {
      res.status(404).json({ error: "That employee was not found." });
      return;
    }
    if (result === "before-joining") {
      res.status(400).json({ error: "That person had not joined by this date." });
      return;
    }
    res.json(result);
  } catch (error) {
    databaseError(res, error);
  }
});

app.get("/api/organisations/:id/employees/:employeeId/advances", async (req, res) => {
  try {
    const ledger = await store.getAdvances(req.params.id, req.params.employeeId);
    if (!ledger) {
      res.status(404).json({ error: "That employee was not found." });
      return;
    }
    res.json(ledger);
  } catch (error) {
    databaseError(res, error);
  }
});

app.post("/api/organisations/:id/employees/:employeeId/advances", async (req, res) => {
  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the amount and date." });
    return;
  }

  try {
    const result = await store.addAdvance(req.params.id, req.params.employeeId, parsed.data);
    if (result === "missing") {
      res.status(404).json({ error: "That employee was not found." });
      return;
    }
    if (result === "before-joining") {
      res.status(400).json({ error: "That person had not joined by this date." });
      return;
    }
    if (result === "outside-month") {
      res.status(400).json({ error: "Choose a day in this month, up to today." });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    databaseError(res, error);
  }
});

app.delete("/api/organisations/:id/employees/:employeeId/advances/:advanceId", async (req, res) => {
  try {
    const ledger = await store.removeAdvance(req.params.id, req.params.employeeId, req.params.advanceId);
    if (!ledger) {
      res.status(404).json({ error: "That amount was not found." });
      return;
    }
    res.json(ledger);
  } catch (error) {
    databaseError(res, error);
  }
});

app.patch("/api/organisations/:id/employees/:employeeId", async (req, res) => {
  const parsed = employeeSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the employee settings." });
    return;
  }

  try {
    const employee = await store.updateEmployee(req.params.id, req.params.employeeId, parsed.data);
    if (!employee) {
      res.status(404).json({ error: "That employee was not found." });
      return;
    }
    res.json(employee);
  } catch (error) {
    databaseError(res, error);
  }
});

app.use(
  "/api/billing",
  createBillingRouter({
    store: billing,
    requireAdmin,
    adminId: (res) => currentAdmin(res).id,
    ownsOrganisation: async (ownerId, organisationId) => {
      const organisation = await store.getOrganisation(organisationId);
      return organisation?.ownerId === ownerId;
    },
  }),
);

app.use((_req, res) => {
  res.status(404).json({ error: "That path does not exist." });
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "The request body is not valid JSON." });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ error: "That request is too large." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});
