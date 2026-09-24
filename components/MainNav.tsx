// Barra de navegação principal, compartilhada por todas as páginas do dashboard.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Reuniões", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
