// Cliente Supabase configurado via variáveis de ambiente.
//
// Configure em .env.local (veja .env.local.example):
//   NEXT_PUBLIC_SUPABASE_URL=...
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//
// Enquanto essas variáveis não existirem, `isSupabaseConfigured` fica falso e
// o dashboard roda inteiramente com dados fictícios (veja lib/mock-data.ts),
// permitindo testar a UI antes de plugar o banco real.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
