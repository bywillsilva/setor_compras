import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/config'

export function createClient() {
  const url = getSupabaseUrl()
  const publishableKey = getSupabasePublishableKey()

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase client-side não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return createBrowserClient(
    url,
    publishableKey,
  )
}
