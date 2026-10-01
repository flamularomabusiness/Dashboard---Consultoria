// Sidebar de navegação do INSIGHT: sempre azul-insight (#001C6B) fixo —
// independente do tema claro/escuro — porque é onde a logo mora, e a
// wordmark "INSIGHT" só é legível sobre fundo escuro. Em mobile (<768px)
// vira um painel deslizante controlado por useSidebarMobile().
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, Settings, Users, X } from "lucide-react";

import { useSidebarMobile } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
];

const LINKS_FUTUROS = [
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
];

export function InsightSidebar() {
  const pathname = usePathname();
  const { aberta, fechar } = useSidebarMobile();

  return (
    <>
      {/* Overlay no mobile, pra fechar tocando fora do painel */}
      {aberta && (
        <button
          aria-label="Fechar menu"
          onClick={fechar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-brand-navy text-white transition-transform duration-200 md:static md:translate-x-0",
          aberta ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 p-4">
          <Link href="/" className="min-w-0" onClick={fechar}>
            <Image
              src="/logo-insight.png"
              alt="INSIGHT — Grupo ROMABC x Green+"
              width={1672}
              height={941}
              className="h-auto w-44"
              priority
            />
          </Link>
          <button
            aria-label="Fechar menu"
            onClick={fechar}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={fechar}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}

          <div className="my-2 border-t border-white/10" />

          {LINKS_FUTUROS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              title="Em breve"
              className="flex cursor-not-allowed items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/35"
            >
              <span className="flex items-center gap-2.5">
                <Icon className="size-4" />
                {label}
              </span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Em breve
              </span>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          © 2026 ROMABC - GREEN+
        </div>
      </aside>
    </>
  );
}
