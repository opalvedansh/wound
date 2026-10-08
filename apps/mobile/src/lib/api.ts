import type { Me } from '@antigravity-project-spec-pack/domain/api';
import { supabase } from './supabase';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:3333/api' : '')).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let clinicId: string | null = null;
/** The clinic the app works in (the first one the user belongs to). */
export const setClinic = (id: string | null) => {
  clinicId = id;
};

/** Calls the NestJS API as the signed-in user. Throws ApiError (status 0 when offline). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError('The app has no server address (EXPO_PUBLIC_API_URL).', 0);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Signed out.', 401);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the server.", 0);
  }
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(typeof body?.message === 'string' ? body.message : `The server answered ${response.status}.`, response.status);
  return body as T;
}

export const fetchMe = () => api<Me>('/me');
