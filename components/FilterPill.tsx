// Pill de filtro selecionável (toggle) — usado nos dois dashboards pros
// filtros booleanos ("só atrasados", "marcos hoje" etc.).
"use client";

import { cn } from "@/lib/utils";

interface FilterPillProps {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function FilterPill({ ativo, onClick, children, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
        ativo
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
        className,
      )}
    >
      {children}
    </button>
  );
}
