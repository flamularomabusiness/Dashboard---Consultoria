// Barra de navegação principal, compartilhada por todas as páginas do dashboard.
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { CalendarCheck, Moon, Sun, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Reuniões", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    // bg + text via --heading/--primary-foreground (não "white" fixo): no modo
    // escuro --heading vira verde água (claro), e precisa de texto escuro
    // para ter contraste — --primary-foreground já cobre esse par nos dois
    // temas (branco no claro, azul escuro no escuro).
    <nav className="bg-[var(--heading)] text-primary-foreground">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-1 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <ThemeToggle />
      </div>
    </nav>
  );
}

/** Alterna claro/escuro e persiste a escolha (localStorage, via next-themes). */
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
      className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
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
