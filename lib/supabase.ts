// Cliente Supabase do projeto GRUPO ROMABC (mesmo Supabase da plataforma de
// mensalidades). A URL e a anon/publishable key abaixo são o padrão em produção;
// .env.local pode sobrescrevê-las (veja .env.local.example) para apontar para
// outro projeto Supabase em desenvolvimento, sem precisar tocar neste arquivo.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mpzhmkucdpugceflyltx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_lQ6W9wwaU9L1uH7SIzgTpw_2kgA3Bak";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
