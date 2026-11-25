import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { setRefreshHandler, setTokens } from "@/lib/auth-tokens";
import { ApiError, login as loginRequest, logout as logoutRequest, refreshSession, signup as signupRequest } from "@/lib/api";
import { useServerUrl } from "@/lib/server-url";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "@/lib/session-store";
import type { AdminSession } from "@/lib/types";

type SessionValue = {
  session: AdminSession | null;
  ready: boolean;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { url } = useServerUrl();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  async function save(next: AdminSession) {
    setTokens(next);
    setSession(next);
    await saveStoredSession(next);
  }

  async function clear() {
    setTokens(null);
    setSession(null);
    await clearStoredSession();
  }

  useEffect(() => {
    let active = true;
    loadStoredSession()
      .then((saved) => {
        if (!active || !saved) return;
        // No access token is stored: the first request gets a 401 and refreshes it.
        const restored: AdminSession = { accessToken: "", ...saved };
        setTokens(restored);
        setSession(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRefreshHandler(async () => {
      const saved = await loadStoredSession().catch(() => null);
      if (!saved) return false;
      try {
        const next = await refreshSession(url, saved.refreshToken);
        await save(next);
        return true;
      } catch (error) {
        // Sign out only when the server says the session is over. No internet, a sign-in
        // service outage (502) or too many tries (429) keep the session for the next attempt.
        if (error instanceof ApiError && error.kind === "http" && error.status === 401) await clear();
        return false;
      }
    });
    return () => setRefreshHandler(null);
  }, [url]);

  async function signup(input: { name: string; email: string; password: string }) {
    await save(await signupRequest(url, input));
  }

  async function login(input: { email: string; password: string }) {
    await save(await loginRequest(url, input));
  }

  async function logout() {
    try {
      await logoutRequest(url);
    } catch {
      // The phone still forgets the session when the server is unreachable.
    }
    await clear();
  }

  return (
    <SessionContext.Provider value={{ session, ready, signup, login, logout }}>
      {ready ? children : null}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
