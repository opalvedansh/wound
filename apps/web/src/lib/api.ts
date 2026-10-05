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

/** Calls the NestJS API as the signed-in user. Throws ApiError with the API's own message on failure. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(`Can't reach the API at ${API_URL}.`, 0);
  }

  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const problems = Array.isArray(body?.problems) ? body.problems.filter((p: unknown) => typeof p === 'string') : [];
    const message = typeof body?.message === 'string' ? body.message : `The API answered ${response.status}.`;
    throw new ApiError(message, response.status, problems);
  }
  return body as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
