import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __meetBabySupabaseAdmin: SupabaseClient | undefined;
}

function getSupabaseUrl(): string {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 尚未設定。");
  }
  return supabaseUrl;
}

function getSupabaseServiceRoleKey(): string {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 尚未設定。");
  }
  return serviceRoleKey;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (globalThis.__meetBabySupabaseAdmin) {
    return globalThis.__meetBabySupabaseAdmin;
  }

  const client = createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  globalThis.__meetBabySupabaseAdmin = client;
  return client;
}
