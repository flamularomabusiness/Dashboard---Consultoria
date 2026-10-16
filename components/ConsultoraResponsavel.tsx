// Nome da consultora responsável pelo cliente. Sem responsável, o administrador vê o
// selo "Sem responsável" (para saber que precisa definir uma); os demais veem "-".
"use client";

import { Badge } from "@/components/ui/badge";
import { useIdentidade } from "@/lib/auth-context";
import type { Consultora } from "@/lib/types";

export function ConsultoraResponsavel({ consultora }: { consultora: Consultora | null }) {
  const { ehAdmin } = useIdentidade();

  if (consultora) return <>{consultora.nome}</>;
  if (!ehAdmin) return <>-</>;

  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-100 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    >
      Sem responsável
    </Badge>
  );
}
