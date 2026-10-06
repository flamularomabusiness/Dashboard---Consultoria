// Header INSIGHT: busca + notificações + tema + perfil (com "Sair").
"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Bell, LogOut, Menu, Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useBusca } from "@/lib/search-context";
import { useSidebarMobile } from "@/lib/sidebar-context";

export function InsightHeader() {
  const { busca, setBusca } = useBusca();
  const { abrir } = useSidebarMobile();

  return (
    <header className="flex items-center gap-3 border-b border-border bg-brand-navy px-4 py-3 text-white md:bg-background md:text-foreground">
      <button
        aria-label="Abrir menu"
        onClick={abrir}
        className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white md:hidden"
      >
        <Menu className="size-5" />
      </button>

      <Image
        src="/logo-insight.png"
        alt="INSIGHT"
        width={1672}
        height={941}
        className="h-7 w-auto md:hidden"
        priority
      />

      <div className="relative ml-auto max-w-sm flex-1 md:ml-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por clientes ou reuniões..."
          className="h-9 w-full rounded-full border border-border bg-background pr-4 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:bg-muted"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <NotificacoesMenu />
        <ThemeToggle />
        <PerfilMenu />
      </div>
    </header>
  );
}

/** Sem dados reais de notificação ainda — mostra um estado vazio honesto em vez de inventar contador. */
function NotificacoesMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white/80 hover:bg-white/10 hover:text-white md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground"
          title="Notificações"
        >
          <Bell className="size-4" />
          <span className="sr-only">Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1 text-sm text-muted-foreground">Nenhuma notificação.</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);

  // Evita mismatch de hidratação: no server não sabemos a preferência salva
  // (padrão recomendado pelo próprio next-themes para esse caso).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMontado(true), []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-white/80 hover:bg-white/10 hover:text-white md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground"
      title="Alternar tema claro/escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {montado && resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      <span className="sr-only">Alternar tema claro/escuro</span>
    </Button>
  );
}

/** Avatar com a inicial do usuário logado, nome/papel e "Sair". */
function PerfilMenu() {
  const { estado, sair } = useAuth();
  if (estado.status !== "autorizado") return null;

  const { nome, email, role } = estado.perfil;
  const exibicao = nome?.trim() || email || "Usuário";
  const inicial = exibicao.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={exibicao}
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white md:bg-primary md:text-primary-foreground"
        >
          <span className="sr-only">Abrir menu de perfil</span>
          {inicial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-1.5 py-1.5">
          <p className="truncate text-sm font-medium">{exibicao}</p>
          {email && email !== exibicao && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
          <p className="text-xs text-muted-foreground capitalize">
            {role === "administrator" ? "Administrador" : role}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void sair()}>
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
