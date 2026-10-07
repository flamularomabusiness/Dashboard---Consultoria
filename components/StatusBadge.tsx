// Badge visual do status de uma reunião (ver `calcularStatusReuniao` em lib/utils.ts):
// azul (agendada), laranja (pendente_drive), vermelho (atrasado) ou verde (finalizada).
// Usado pela tabela e pelo modal de detalhes — assim os dois mostram sempre o mesmo.
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusReuniaoCalculado } from "@/lib/types";

const CONFIG: Record<StatusReuniaoCalculado, { label: string; icone: string; className: string }> = {
  agendada: {
    label: "Agendada",
    icone: "📅",
    className: "border-brand-blue/40 bg-brand-blue/10 text-brand-blue dark:text-brand-green",
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
  finalizada: {
    label: "Finalizada",
    icone: "✅",
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
};

export function StatusBadge({ status }: { status: StatusReuniaoCalculado }) {
  const { label, icone, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <span aria-hidden="true">{icone}</span>
      {label}
    </Badge>
  );
}
