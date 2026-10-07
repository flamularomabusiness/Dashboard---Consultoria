// Fornece `nomeExibicao(clienteNome)`: "Razão Social (NOME FANTASIA)" quando a
// plataforma tem nome fantasia para o cliente, senão só o nome. O banco continua
// guardando apenas `cliente_nome` — a fantasia é só para exibir (e buscar).
"use client";

import * as React from "react";

import { buscarFantasia, criarIndiceFantasia, type ClienteComFantasia } from "@/lib/nomes-cliente";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { formatarNomeCliente } from "@/lib/utils";

type NomeExibicao = (clienteNome: string) => string;

const NomesClienteContext = React.createContext<NomeExibicao>((nome) => nome);

export function NomesClienteProvider({ children }: { children: React.ReactNode }) {
  const [indice, setIndice] = React.useState<Map<string, string | null>>(new Map());

  React.useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let ativo = true;
    supabase
      .from("clientes")
      .select("nome_razao_social, nome_fantasia")
      .then(({ data, error }) => {
        if (error) {
          // Sem fantasia a tela continua funcionando, só mostra o nome simples.
          console.error("Erro ao carregar nomes fantasia:", error.message);
          return;
        }
        if (ativo) setIndice(criarIndiceFantasia((data ?? []) as ClienteComFantasia[]));
      });
    return () => {
      ativo = false;
    };
  }, []);

  const nomeExibicao = React.useCallback<NomeExibicao>(
    (clienteNome) => formatarNomeCliente(clienteNome, buscarFantasia(clienteNome, indice)),
    [indice],
  );

  return <NomesClienteContext.Provider value={nomeExibicao}>{children}</NomesClienteContext.Provider>;
}

/** `nomeExibicao(cliente_nome)` -> "Razão Social (FANTASIA)" ou só o nome. */
export function useNomeExibicao(): NomeExibicao {
  return React.useContext(NomesClienteContext);
}
