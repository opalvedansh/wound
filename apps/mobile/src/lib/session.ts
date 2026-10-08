import type { Me } from '@antigravity-project-spec-pack/domain/api';
import { appStorage } from '../store/appStorage';
import { useVisitStore } from '../store/useVisitStore';
import { fetchMe, setClinic } from './api';
import { supabase } from './supabase';

const ME_KEY = 'me';

/** The signed-in user's clinic and role, kept so the app opens offline. */
export async function storedMe(): Promise<Me | null> {
  try {
    const raw = await appStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

async function remember(me: Me) {
  setClinic(me.memberships[0]?.clinicId ?? null);
  await appStorage.setItem(ME_KEY, JSON.stringify(me));
}

/** On launch: signed in (with the last known clinic, even offline) or not. Refreshes the profile when online. */
export async function restoreSession(): Promise<Me | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const cached = await storedMe();
  if (cached) setClinic(cached.memberships[0]?.clinicId ?? null);
  try {
    const me = await fetchMe();
    await remember(me);
    return me;
  } catch {
    return cached;
  }
}

/** Signs in; refuses accounts that aren't in a clinic yet. */
export async function signIn(email: string, password: string): Promise<Me> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
  const me = await fetchMe();
  if (!me.memberships.length) {
    await supabase.auth.signOut();
    throw new Error("Your account isn't in a clinic yet. Ask your clinic admin to invite you.");
  }
  // Another person's records never stay on a shared phone.
  const previous = await storedMe();
  if (previous && previous.id !== me.id) useVisitStore.getState().clearAll();
  await remember(me);
  return me;
}

/** Signs out and removes this clinic's records from the device. Unsynced changes are lost, so callers warn first. */
export async function signOut() {
  await supabase.auth.signOut();
  useVisitStore.getState().clearAll();
  setClinic(null);
  await appStorage.removeItem(ME_KEY);
}
