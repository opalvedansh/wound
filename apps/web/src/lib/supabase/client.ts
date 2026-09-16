import { createBrowserClient } from '@supabase/ssr'

// Browser client that stores session in cookies — required for SSR middleware to read the session
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton for client components
export const supabaseBrowser = createClient()
