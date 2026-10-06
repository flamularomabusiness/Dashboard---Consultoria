// Sessão do usuário (Supabase Auth — o mesmo login da plataforma de mensalidades).
// Estar logado NÃO basta: o acesso ao INSIGHT exige uma linha ativa em `usuarios`
// com um papel permitido. Essa checagem é feita no banco (função perfil_insight,
// ver supabase/schema.sql) — o gate de tela abaixo é só UX; quem protege os dados
// de verdade são as policies de RLS, que usam a mesma regra.
"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export interface PerfilInsight {
  nome: string | null;
  role: string;
  email: string | null;
}

export type EstadoAuth =
  | { status: "carregando" }
  | { status: "deslogado" }
  | { status: "sem_acesso"; email: string | null }
  | { status: "autorizado"; perfil: PerfilInsight };

interface AuthContextValue {
  estado: EstadoAuth;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function resolverEstado(session: Session | null): Promise<EstadoAuth> {
  if (!supabase) return { status: "deslogado" };
  if (!session) return { status: "deslogado" };

  const { data, error } = await supabase.rpc("perfil_insight");
  if (error) {
    // Função ainda não criada (SQL não rodado) ou falha de rede: não libera nada.
    console.error("Erro ao verificar acesso ao INSIGHT:", error.message);
    return { status: "sem_acesso", email: session.user.email ?? null };
  }
  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil) return { status: "sem_acesso", email: session.user.email ?? null };
  return { status: "autorizado", perfil: perfil as PerfilInsight };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = React.useState<EstadoAuth>({ status: "carregando" });

  React.useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Sem Supabase (dev local sem credenciais) o app roda só com dados fictícios.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado({
        status: "autorizado",
        perfil: { nome: "Desenvolvimento", role: "administrator", email: null },
      });
      return;
    }

    let ativo = true;
    // Não chame outras funções do supabase dentro do callback de onAuthStateChange
    // (pode travar o cliente) — adia a verificação com setTimeout.
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      setTimeout(async () => {
        const proximo = await resolverEstado(session);
        if (ativo) setEstado(proximo);
      }, 0);
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const entrar = React.useCallback(async (email: string, senha: string) => {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      if (error.message.toLowerCase().includes("invalid login")) {
        throw new Error("E-mail ou senha incorretos.");
      }
      throw new Error(error.message);
    }
  }, []);

  const sair = React.useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const valor = React.useMemo(() => ({ estado, entrar, sair }), [estado, entrar, sair]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
