import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";


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

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

type AuthApi = {
  signup(input: { name: string; email: string; password: string }): Promise<AdminSession>;
  login(input: { email: string; password: string }): Promise<AdminSession>;
  refresh(refreshToken: string): Promise<AdminSession>;
  logout(accessToken: string): Promise<void>;
  adminFromToken(accessToken: string): Promise<Admin | null>;
};

type GoTrueUser = {
  id?: string;
  email?: string;
  user_metadata?: { name?: string };
};

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  user?: GoTrueUser;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  error_code?: string;
};

export function createAuth(): AuthApi | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return null;

  function adminFromUser(user: GoTrueUser | undefined): Admin | null {
    if (!user?.id || !user.email) return null;
    const named = user.user_metadata?.name?.trim();
    return { id: user.id, email: user.email, name: named ? named : user.email };
  }

  function sessionFrom(body: TokenBody): AdminSession {
    const admin = adminFromUser(body.user);
    if (!body.access_token || !body.refresh_token || !admin) {
      throw new AuthError("Sign-in did not return a session.", 502);
    }
    return { accessToken: body.access_token, refreshToken: body.refresh_token, admin };
  }

  async function gotrue<T>(path: string, init: RequestInit & { token?: string }): Promise<T> {
    const { token, ...request } = init;
    const bearer = token === undefined ? key : token;
    let response: Response;
    try {
      response = await fetch(`${url}/auth/v1${path}`, {
        ...request,
        headers: {
          apikey: key,
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    } catch {
      throw new AuthError("The sign-in service did not respond.", 502);
    }

    if (response.status === 204) return {} as T;
    const body = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) {
      throw new AuthError(friendlyAuthMessage(body as TokenBody, response.status), response.status);
    }
    return body;
  }

  return {
    async signup(input) {
      await gotrue<TokenBody>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: { name: input.name },
        }),
      });
      return this.login(input);
    },
    async login(input) {
      const body = await gotrue<TokenBody>("/token?grant_type=password", {
        method: "POST",
        token: "",
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      return sessionFrom(body);
    },
    async refresh(refreshToken) {
      const body = await gotrue<TokenBody>("/token?grant_type=refresh_token", {
        method: "POST",
        token: "",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      return sessionFrom(body);
    },
    async logout(accessToken) {
      await gotrue<TokenBody>("/logout", { method: "POST", token: accessToken });
    },
    async adminFromToken(accessToken) {
      try {
        const user = await gotrue<GoTrueUser>("/user", { method: "GET", token: accessToken });
        return adminFromUser(user);
      } catch (error) {
        if (error instanceof AuthError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
  };
}

function friendlyAuthMessage(body: TokenBody, status: number): string {
  const raw = body.error_description || body.msg || body.message || body.error || "";
  const code = body.error_code ?? "";
  if (code === "email_exists" || /already (been )?registered|already exists/i.test(raw)) {
    return "An account with that email already exists.";
  }
  if (body.error === "invalid_grant" || /invalid login/i.test(raw)) {
    return "That email or password is wrong.";
  }
  if (status === 422 || status === 400) {
    return raw && raw.length < 160 ? raw : "Check the email and password.";
  }
  return "Sign-in failed.";
}

/**
 * Sign-in for local development when Supabase is not configured, so the in-memory store can be used.
 * Accounts, passwords and tokens live in this process only and vanish on restart.
 * Never used when NODE_ENV is "production".
 */
export function createMemoryAuth(): AuthApi | null {
  if (process.env.NODE_ENV === "production") return null;

  const ACCESS_TTL_MS = 60 * 60 * 1000;
  type Account = Admin & { salt: string; hash: string };
  const accounts = new Map<string, Account>();
  const accessTokens = new Map<string, { adminId: string; expires: number }>();
  const refreshTokens = new Map<string, string>();

  function hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString("hex");
  }

  function issue(account: Account): AdminSession {
    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(32).toString("hex");
    accessTokens.set(accessToken, { adminId: account.id, expires: Date.now() + ACCESS_TTL_MS });
    refreshTokens.set(refreshToken, account.id);
    return { accessToken, refreshToken, admin: { id: account.id, email: account.email, name: account.name } };
  }

  function byId(id: string): Account | undefined {
    for (const account of accounts.values()) if (account.id === id) return account;
    return undefined;
  }

  return {
    async signup(input) {
      const email = input.email.toLowerCase();
      if (accounts.has(email)) throw new AuthError("An account with that email already exists.", 422);
      const salt = randomBytes(16).toString("hex");
      const account: Account = { id: randomUUID(), email, name: input.name, salt, hash: hashPassword(input.password, salt) };
      accounts.set(email, account);
      return issue(account);
    },
    async login(input) {
      const account = accounts.get(input.email.toLowerCase());
      const expected = account ? Buffer.from(account.hash, "hex") : Buffer.alloc(64);
      const actual = Buffer.from(hashPassword(input.password, account?.salt ?? "no-account"), "hex");
      if (!account || !timingSafeEqual(expected, actual)) throw new AuthError("That email or password is wrong.", 400);
      return issue(account);
    },
    async refresh(refreshToken) {
      const adminId = refreshTokens.get(refreshToken);
      const account = adminId ? byId(adminId) : undefined;
      if (!account) throw new AuthError("Sign in to continue.", 401);
      refreshTokens.delete(refreshToken);
      return issue(account);
    },
    async logout(accessToken) {
      accessTokens.delete(accessToken);
    },
    async adminFromToken(accessToken) {
      const found = accessTokens.get(accessToken);
      if (!found || found.expires < Date.now()) return null;
      const account = byId(found.adminId);
      return account ? { id: account.id, email: account.email, name: account.name } : null;
    },
  };
}
