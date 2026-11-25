import { getAccessToken, refreshAccessToken } from "@/lib/auth-tokens";
import type {
  AdminSession,
  AdvanceLedger,
  AttendanceDay,
  EmployeeMonth,
  Employee,
  EmployeeSettings,
  NewEmployee,
  Health,
  Organisation,
  OrganisationDetail,
  OrganisationProfile,
  OrganisationSummary,
} from "@/lib/types";

export class ApiError extends Error {
  /** "network" when nothing answered, "http" when the server answered with an error. */
  readonly kind: "network" | "http";
  readonly status: number | null;

  constructor(message: string, kind: "network" | "http" = "http", status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** True when the phone could not reach the server at all. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.kind === "network";
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function request<T>(baseUrl: string, path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const accessToken = getAccessToken();
  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("The server did not respond. Check the internet. If the server was asleep, it can take a minute to wake: try again.", "network");
  }

  if (response.status === 401 && attempt === 0 && !path.startsWith("/api/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(baseUrl, path, init, 1);
  }

  if (!response.ok) {
    let message = `The request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // The body was not JSON.
    }
    throw new ApiError(message, "http", response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function signup(
  baseUrl: string,
  input: { name: string; email: string; password: string },
): Promise<AdminSession> {
  return request<AdminSession>(baseUrl, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(baseUrl: string, input: { email: string; password: string }): Promise<AdminSession> {
  return request<AdminSession>(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function refreshSession(baseUrl: string, refreshToken: string): Promise<AdminSession> {
  return request<AdminSession>(baseUrl, "/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(baseUrl: string): Promise<void> {
  return request<void>(baseUrl, "/api/auth/logout", { method: "POST" });
}

export function getHealth(baseUrl: string): Promise<Health> {
  return request<Health>(baseUrl, "/health");
}

export function listOrganisations(baseUrl: string): Promise<OrganisationSummary[]> {
  return request<OrganisationSummary[]>(baseUrl, "/api/organisations");
}

export function createOrganisation(baseUrl: string, profile: OrganisationProfile): Promise<Organisation> {
  return request<Organisation>(baseUrl, "/api/organisations", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export function updateOrganisation(baseUrl: string, id: string, profile: OrganisationProfile): Promise<Organisation> {
  return request<Organisation>(baseUrl, `/api/organisations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
}

export function getOrganisation(baseUrl: string, id: string): Promise<OrganisationDetail> {
  return request<OrganisationDetail>(baseUrl, `/api/organisations/${id}`);
}

export function createEmployee(
  baseUrl: string,
  organisationId: string,
  input: NewEmployee,
): Promise<Employee> {
  return request<Employee>(baseUrl, `/api/organisations/${organisationId}/employees`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getEmployeeMonth(
  baseUrl: string,
  organisationId: string,
  employeeId: string,
  month: string,
): Promise<EmployeeMonth> {
  return request<EmployeeMonth>(
    baseUrl,
    `/api/organisations/${organisationId}/employees/${employeeId}/attendance?month=${month}`,
  );
}

export function getAttendance(baseUrl: string, organisationId: string, date: string): Promise<AttendanceDay> {
  return request<AttendanceDay>(baseUrl, `/api/organisations/${organisationId}/attendance?date=${date}`);
}

export function saveAttendance(
  baseUrl: string,
  organisationId: string,
  date: string,
  employeeIds: string[],
): Promise<AttendanceDay> {
  return request<AttendanceDay>(baseUrl, `/api/organisations/${organisationId}/attendance`, {
    method: "PUT",
    body: JSON.stringify({ date, employeeIds }),
  });
}

export function getAdvances(baseUrl: string, organisationId: string, employeeId: string): Promise<AdvanceLedger> {
  return request<AdvanceLedger>(baseUrl, `/api/organisations/${organisationId}/employees/${employeeId}/advances`);
}

export function addAdvance(
  baseUrl: string,
  organisationId: string,
  employeeId: string,
  input: { amount: number; givenOn: string },
): Promise<AdvanceLedger> {
  return request<AdvanceLedger>(baseUrl, `/api/organisations/${organisationId}/employees/${employeeId}/advances`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeAdvance(
  baseUrl: string,
  organisationId: string,
  employeeId: string,
  advanceId: string,
): Promise<AdvanceLedger> {
  return request<AdvanceLedger>(baseUrl, `/api/organisations/${organisationId}/employees/${employeeId}/advances/${advanceId}`, {
    method: "DELETE",
  });
}

export function updateEmployee(
  baseUrl: string,
  organisationId: string,
  employeeId: string,
  input: EmployeeSettings,
): Promise<Employee> {
  return request<Employee>(baseUrl, `/api/organisations/${organisationId}/employees/${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
