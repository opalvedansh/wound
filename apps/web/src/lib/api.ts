import { supabaseBrowser } from './supabase/client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Validation problems, when the API lists them. */
    readonly problems: string[] = [],
  ) {
    super(message);
  }
}

const CLINIC_KEY = 'wound.clinicId';
let clinicId: string | null = null;
try {
  clinicId = typeof window !== 'undefined' ? window.localStorage.getItem(CLINIC_KEY) : null;
} catch {
  clinicId = null;
}

/** The clinic every request acts in (members of several clinics pick one in the sidebar). */
export const activeClinicId = () => clinicId;
export function setActiveClinicId(id: string | null) {
  clinicId = id;
  try {
    if (id) window.localStorage.setItem(CLINIC_KEY, id);
    else window.localStorage.removeItem(CLINIC_KEY);
  } catch {
    // private mode: the choice lasts until reload
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  // Read from the cookie; only refreshes (one network call) when the token is about to expire.
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        // JSON bodies only: a FormData upload sets its own multipart type and boundary.
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(`Can't reach the server. Check your connection and try again.`, 0);
  }
}

async function failure(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  const problems = Array.isArray(body?.problems) ? body.problems.filter((p: unknown) => typeof p === 'string') : [];
  const message = typeof body?.message === 'string' ? body.message : `The server answered ${response.status}.`;
  if (response.status === 401 && typeof window !== 'undefined') {
    // The session ended (signed out elsewhere, or expired): back to the sign-in page.
    void supabaseBrowser.auth.signOut().finally(() => window.location.assign('/login'));
  }
  throw new ApiError(message, response.status, problems);
}

/** Calls the NestJS API as the signed-in user. Throws ApiError with the API's own message on failure. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init);
  if (!response.ok) return failure(response);
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => undefined)) as T;
}

/** A JSON POST/PATCH/PUT with an Idempotency-Key, so a retried click never creates the record twice. */
export const send = <T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown, key = crypto.randomUUID()) =>
  api<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: method === 'POST' ? { 'Idempotency-Key': key } : undefined,
  });

/** Downloads a file the API streams (exports), named as the API names it. */
export async function download(path: string): Promise<void> {
  const response = await request(path);
  if (!response.ok) return failure(response);
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(await response.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
