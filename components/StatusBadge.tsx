// Badge visual de status: verde (completa), amarelo (aguardando) ou vermelho (atrasado).
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusVisual } from "@/lib/types";

const CONFIG: Record<
  StatusVisual,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  completa: {
    label: "Completa",
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  aguardando: {
    label: "Aguardando ATA",
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  },
  atrasado: {
    label: "Atrasado",
    icon: AlertCircle,
    className:
      "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

export function StatusBadge({ status }: { status: StatusVisual }) {
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
