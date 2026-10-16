// Sessão do usuário (Supabase Auth — o mesmo login da plataforma de mensalidades).
// Estar logado NÃO basta: o acesso ao INSIGHT exige uma linha ativa em `usuarios`
// com um papel permitido. Essa checagem é feita no banco (função perfil_insight,
// ver supabase/schema.sql) — o gate de tela abaixo é só UX; quem protege os dados
// de verdade são as policies de RLS, que usam a mesma regra.
"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";

import { traduzirErroCadastro } from "@/lib/erros-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export interface PerfilInsight {
  nome: string | null;
  role: string;
  email: string | null;
  /** Id da consultora vinculada ao usuário (RPC consultora_atual); null se não houver (ex.: admin sem consultora). */
  consultoraId: string | null;
}

export type EstadoAuth =
  | { status: "carregando" }
  | { status: "deslogado" }
  /** Logado, mas sem permissão para o dashboard (perfil_insight vazio). */
  | { status: "sem_acesso"; email: string | null }
  /** Logado, mas não foi possível verificar a permissão (falha de rede/banco) — diferente de "sem acesso". */
  | { status: "erro_acesso"; email: string | null }
  | { status: "autorizado"; perfil: PerfilInsight };

interface AuthContextValue {
  estado: EstadoAuth;
  entrar: (email: string, senha: string) => Promise<void>;
  /** Cria a conta (nome vai em options.data.nome). `precisaConfirmar`: o Supabase exige confirmar o email antes de entrar. */
  criarConta: (nome: string, email: string, senha: string) => Promise<{ precisaConfirmar: boolean }>;
  /** Refaz a checagem de permissão do usuário logado (botão "Tentar novamente"). */
  verificarAcesso: () => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function resolverEstado(session: Session | null): Promise<EstadoAuth> {
  if (!supabase) return { status: "deslogado" };
  if (!session) return { status: "deslogado" };

  const { data, error } = await supabase.rpc("perfil_insight");
  if (error) {
    // Falha de rede/banco (ou função ausente): não libera nada, mas também não afirma que
    // a pessoa "não tem acesso" — pede para tentar de novo.
    console.error("Erro ao verificar acesso ao INSIGHT:", error.message);
    return { status: "erro_acesso", email: session.user.email ?? null };
  }
  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil) return { status: "sem_acesso", email: session.user.email ?? null };

  // Vínculo usuário -> consultora. Falha aqui não tira o acesso: só deixa a pessoa
  // sem as ações restritas ao "dono" (o banco valida tudo de novo de qualquer jeito).
  const { data: consultoraId, error: erroConsultora } = await supabase.rpc("consultora_atual");
  if (erroConsultora) console.error("Erro ao identificar a consultora do usuário:", erroConsultora.message);

  return {
    status: "autorizado",
    perfil: { ...(perfil as Omit<PerfilInsight, "consultoraId">), consultoraId: (consultoraId as string | null) ?? null },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = React.useState<EstadoAuth>({ status: "carregando" });

  React.useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Sem Supabase (dev local sem credenciais) o app roda só com dados fictícios.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado({
        status: "autorizado",
        perfil: { nome: "Desenvolvimento", role: "administrator", email: null, consultoraId: null },
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

  const criarConta = React.useCallback(async (nome: string, email: string, senha: string) => {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome } },
    });
    if (error) {
      console.error("Erro ao criar conta:", error.message);
      throw new Error(traduzirErroCadastro(error.message));
    }
    // Com confirmação de email ligada, um email que já tem conta não dá erro: o Supabase
    // devolve um usuário sem identidades (para não revelar quais emails existem).
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("Este email já possui conta. Entre com sua senha.");
    }
    return { precisaConfirmar: !data.session };
  }, []);

  const verificarAcesso = React.useCallback(async () => {
    if (!supabase) return;
    setEstado({ status: "carregando" });
    const { data } = await supabase.auth.getSession();
    setEstado(await resolverEstado(data.session));
  }, []);

  const sair = React.useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const valor = React.useMemo(
    () => ({ estado, entrar, criarConta, verificarAcesso, sair }),
    [estado, entrar, criarConta, verificarAcesso, sair],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Identidade para decidir o que mostrar na interface (o banco valida de verdade). */
export function useIdentidade(): { ehAdmin: boolean; consultoraId: string | null } {
  const { estado } = useAuth();
  if (estado.status !== "autorizado") return { ehAdmin: false, consultoraId: null };
  return {
    ehAdmin: estado.perfil.role === "administrator",
    consultoraId: estado.perfil.consultoraId,
  };
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
