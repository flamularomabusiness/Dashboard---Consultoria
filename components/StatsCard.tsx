// Card de estatística padrão do INSIGHT: gradient sutil azul→verde, ícone em
// destaque verde, número grande e seta de tendência opcional.
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  trend?: { valor: string; direcao: "alta" | "baixa" };
  className?: string;
}

export function StatsCard({ label, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card
      className={cn(
        "border-brand-blue/30 bg-gradient-to-br from-brand-navy/[0.06] to-brand-green/[0.08]",
        "dark:from-brand-green/[0.08] dark:to-brand-blue/[0.1]",
        className,
      )}
    >
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-5 text-brand-green" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <span className="text-3xl font-bold text-heading">{value}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              trend.direcao === "alta" ? "text-brand-green" : "text-destructive",
            )}
          >
            {trend.direcao === "alta" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}
            {trend.valor}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
