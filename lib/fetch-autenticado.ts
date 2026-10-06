// fetch para as rotas /api do app, anexando o token da sessão do Supabase
// (as rotas recusam requisições sem ele — ver lib/auth-server.ts).
import { supabase } from "@/lib/supabase";

export async function fetchAutenticado(url: string): Promise<Response> {
  const sessao = supabase ? (await supabase.auth.getSession()).data.session : null;
  return fetch(url, {
    headers: sessao ? { Authorization: `Bearer ${sessao.access_token}` } : {},
  });
}
