// Casca do app: só monta sidebar/header/páginas depois que o usuário está logado
// E autorizado. Enquanto isso, mostra carregando ou a tela de login. As páginas
// nem chegam a montar (e a buscar dados) sem sessão — e, mesmo que alguém
// burlasse este gate no navegador, o banco recusaria via RLS.
"use client";

import { Loader2 } from "lucide-react";

import { InsightHeader } from "@/components/InsightHeader";
import { InsightSidebar } from "@/components/InsightSidebar";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth-context";
import { NomesClienteProvider } from "@/lib/nomes-cliente-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { estado } = useAuth();

  if (estado.status === "carregando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy text-white">
        <Loader2 className="size-6 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  if (estado.status !== "autorizado") return <LoginScreen />;

  return (
    <div className="flex min-h-screen">
      <InsightSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <InsightHeader />
        <div className="flex flex-1 flex-col">
          <NomesClienteProvider>{children}</NomesClienteProvider>
        </div>
      </div>
    </div>
  );
}
