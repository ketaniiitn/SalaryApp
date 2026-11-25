import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "salaryapp.apiUrl";
const DEFAULT_URL = "http://localhost:4000";

type ServerUrlValue = {
  url: string;
  /** The address the app shipped with, before anyone changed it. */
  defaultUrl: string;
  ready: boolean;
  setUrl: (next: string) => Promise<void>;
};

const ServerUrlContext = createContext<ServerUrlValue | null>(null);

export function ServerUrlProvider({ children }: { children: ReactNode }) {
  const fallback = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_URL;
  const [url, setUrlState] = useState(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved) setUrlState(saved);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function setUrl(next: string) {
    const trimmed = next.trim().replace(/\/$/, "");
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    setUrlState(trimmed);
  }

  if (!ready) return null;

  return <ServerUrlContext.Provider value={{ url, defaultUrl: fallback, ready, setUrl }}>{children}</ServerUrlContext.Provider>;
}

export function useServerUrl(): ServerUrlValue {
  const value = useContext(ServerUrlContext);
  if (!value) throw new Error("useServerUrl must be used inside ServerUrlProvider");
  return value;
}
