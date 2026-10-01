// Estado de aberto/fechado da sidebar no mobile (<768px) — compartilhado
// entre InsightHeader (botão hambúrguer) e InsightSidebar (painel deslizante).
"use client";

import * as React from "react";

interface SidebarContextValue {
  aberta: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [aberta, setAberta] = React.useState(false);
  const value = React.useMemo(
    () => ({
      aberta,
      abrir: () => setAberta(true),
      fechar: () => setAberta(false),
      alternar: () => setAberta((v) => !v),
    }),
    [aberta],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarMobile() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarMobile precisa estar dentro de <SidebarProvider>");
  return ctx;
}
