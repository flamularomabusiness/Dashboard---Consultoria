// Busca global do header INSIGHT: o texto digitado fica aqui (contexto
// compartilhado) e cada página decide como filtrar sua própria lista com ele
// — evita prop-drilling entre o header (no layout) e o conteúdo de cada rota.
"use client";

import * as React from "react";

interface SearchContextValue {
  busca: string;
  setBusca: (valor: string) => void;
}

const SearchContext = React.createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [busca, setBusca] = React.useState("");
  const value = React.useMemo(() => ({ busca, setBusca }), [busca]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useBusca() {
  const ctx = React.useContext(SearchContext);
  if (!ctx) throw new Error("useBusca precisa estar dentro de <SearchProvider>");
  return ctx;
}
