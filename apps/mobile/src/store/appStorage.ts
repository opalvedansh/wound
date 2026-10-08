import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Where the app keeps its records on a phone: SQLite (no size limit, unlike the keychain, which holds only the
 * sign-in session). The web build uses appStorage.web.ts.
 */
export const appStorage: StateStorage = {
  getItem: (name) => Storage.getItem(name),
  setItem: (name, value) => Storage.setItem(name, value),
  removeItem: (name) => Storage.removeItem(name),
};
