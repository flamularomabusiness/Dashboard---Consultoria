// Proteção das rotas /api: exige o token da sessão do Supabase (Authorization:
// Bearer ...) e confirma, no banco, que o usuário tem acesso ao INSIGHT — a mesma
// regra das policies de RLS (função tem_acesso_insight). Sem isso, essas rotas
// serviriam os dados da planilha para qualquer um que soubesse a URL.
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mpzhmkucdpugceflyltx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_lQ6W9wwaU9L1uH7SIzgTpw_2kgA3Bak";

/** Retorna uma resposta 401/403 se a requisição não tiver acesso; `null` se estiver liberada. */
export async function exigirAcessoInsight(request: Request): Promise<NextResponse | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // Cliente com o JWT do usuário: o PostgREST valida o token e a função roda como ele.
  const cliente = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await cliente.rpc("tem_acesso_insight");
  if (error) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (data !== true) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  return null;
}
