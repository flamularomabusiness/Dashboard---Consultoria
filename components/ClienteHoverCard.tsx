// Card exibido ao passar o mouse (ou tocar, no mobile) sobre o nome de um cliente
// na tabela de /clientes: dados de contato, plano, consultora e últimas reuniões.
"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { StatusClienteBadge } from "@/components/StatusClienteBadge";
import type { ClienteCRM, Consultora, Reuniao } from "@/lib/types";
import { formatarData, formatarMoedaBR } from "@/lib/utils";

interface ClienteHoverCardProps {
  cliente: ClienteCRM;
  consultora: Consultora | null;
  /** Já filtradas pelo cliente e ordenadas da mais recente para a mais antiga. */
  ultimasReunioes: Reuniao[];
  children: React.ReactNode;
}

export function ClienteHoverCard({
  cliente,
  consultora,
  ultimasReunioes,
  children,
}: ClienteHoverCardProps) {
  // Controlado para funcionar tanto no hover (desktop) quanto no tap (mobile,
  // onde eventos de ponteiro do HoverCardPrimitive não disparam por toque).
  const [open, setOpen] = React.useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default text-left font-medium underline-offset-4 hover:underline"
          onClick={() => setOpen((atual) => !atual)}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex flex-col gap-2">
          <div>
            <p className="font-heading text-sm font-medium">{cliente.nome_razao_social}</p>
            <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj_responsavel}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Email:</dt>
            <dd className="truncate">{cliente.email_responsavel}</dd>

            <dt className="text-muted-foreground">Status:</dt>
            <dd>
              <StatusClienteBadge status={cliente.status} />
            </dd>

            <dt className="text-muted-foreground">Plano:</dt>
            <dd>{formatarMoedaBR(cliente.faturamento_medio)}</dd>

            <dt className="text-muted-foreground">Início:</dt>
            <dd>{formatarData(cliente.data_inicio_contrato)}</dd>

            <dt className="text-muted-foreground">Consultora:</dt>
            <dd>{consultora?.nome ?? "-"}</dd>
          </dl>

          <div className="flex flex-col gap-1 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">Últimas Reuniões</p>
            {ultimasReunioes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma reunião registrada.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {ultimasReunioes.map((reuniao) => (
                  <li key={reuniao.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{reuniao.cliente_nome}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatarData(reuniao.data_reuniao)}
                    </span>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {reuniao.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
