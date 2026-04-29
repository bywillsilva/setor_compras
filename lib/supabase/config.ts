export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null
}

export function getSupabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY ?? null
}

export function hasSupabaseClientConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey())
}

export function hasSupabaseServerConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey())
}
