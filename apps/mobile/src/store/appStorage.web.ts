import type { StateStorage } from 'zustand/middleware';

/** The web build keeps its records in the browser's local storage. */
export const appStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};
