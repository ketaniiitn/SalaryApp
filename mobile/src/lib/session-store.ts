import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Admin } from "@/lib/types";

/**
 * What survives a restart: the refresh token and who is signed in.
 * On a phone it lives in the Keychain (iOS) or Keystore (Android), not in plain AsyncStorage.
 * The access token is never stored: after a restart the first request gets a 401 and refreshes.
 * The web build has no secure store, so it falls back to browser storage there.
 */
export type StoredSession = { refreshToken: string; admin: Admin };

const KEY = "salaryapp.session";
/** Where versions before this one kept the whole session, tokens included, in plain storage. */
const OLD_KEY = "salaryapp.adminSession";
const secure = Platform.OS !== "web";

async function readRaw(): Promise<string | null> {
  return secure ? SecureStore.getItemAsync(KEY) : AsyncStorage.getItem(KEY);
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (!value.refreshToken || !value.admin?.id) return null;
    return { refreshToken: value.refreshToken, admin: value.admin };
  } catch {
    return null;
  }
}

export async function saveStoredSession(value: StoredSession): Promise<void> {
  const raw = JSON.stringify({ refreshToken: value.refreshToken, admin: value.admin });
  if (secure) await SecureStore.setItemAsync(KEY, raw);
  else await AsyncStorage.setItem(KEY, raw);
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const current = parse(await readRaw());
  if (current) return current;
  // Move a session saved by an older version out of plain storage, then delete the plain copy.
  const old = parse(await AsyncStorage.getItem(OLD_KEY));
  if (!old) return null;
  await saveStoredSession(old);
  await AsyncStorage.removeItem(OLD_KEY);
  return old;
}

export async function clearStoredSession(): Promise<void> {
  if (secure) await SecureStore.deleteItemAsync(KEY);
  else await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(OLD_KEY);
}
