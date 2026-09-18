// Badge visual de status: verde (completa), laranja (pendente_drive) ou vermelho (atrasado).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusVisual } from "@/lib/types";

const CONFIG: Record<StatusVisual, { label: string; icone: string; className: string }> = {
  completa: {
    label: "Completa",
    icone: "✅",
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  pendente_drive: {
    label: "Pendente Drive",
    icone: "📁",
    className:
      "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  atrasado: {
    label: "Atrasado",
    icone: "🔴",
    className:
      "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

export function StatusBadge({ status }: { status: StatusVisual }) {
  const { label, icone, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <span aria-hidden="true">{icone}</span>
      {label}
    </Badge>
  );
}
