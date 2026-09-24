// Badge visual do status comercial do cliente: verde (ativo), amarelo (inativo)
// ou vermelho (inadimplente).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusCliente } from "@/lib/types";

const CONFIG: Record<StatusCliente, { label: string; className: string }> = {
  ATIVO: {
    label: "Ativo",
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  INATIVO: {
    label: "Inativo",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  },
  INADIMPLENTE: {
    label: "Inadimplente",
    className:
      "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

export function StatusClienteBadge({ status }: { status: StatusCliente }) {
  const { label, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}
