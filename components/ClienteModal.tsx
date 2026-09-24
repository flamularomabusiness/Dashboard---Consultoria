// Modal de detalhes completos de um cliente, aberto pela ação "Ver Detalhes" na tabela.
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusClienteBadge } from "@/components/StatusClienteBadge";
import type { ClienteCRM, Consultora, Reuniao } from "@/lib/types";
import { formatarData, formatarMoedaBR } from "@/lib/utils";
import { calcularProximoMarco } from "@/lib/calcular-marcos";

interface ClienteModalProps {
  cliente: ClienteCRM | null;
  consultora: Consultora | null;
  /** Já filtradas pelo cliente e ordenadas da mais recente para a mais antiga. */
  ultimasReunioes: Reuniao[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteModal({
  cliente,
  consultora,
  ultimasReunioes,
  open,
  onOpenChange,
}: ClienteModalProps) {
  if (!cliente) return null;

  const marco = calcularProximoMarco(cliente.data_inicio_contrato);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cliente.nome_razao_social}</DialogTitle>
          <DialogDescription>{cliente.cpf_cnpj_responsavel}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{cliente.email_responsavel}</dd>

          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusClienteBadge status={cliente.status} />
          </dd>

          <dt className="text-muted-foreground">Plano</dt>
          <dd>{formatarMoedaBR(cliente.faturamento_medio)}</dd>

          <dt className="text-muted-foreground">Data de Criação</dt>
          <dd>{formatarData(cliente.data_criacao)}</dd>

          <dt className="text-muted-foreground">Início do Contrato</dt>
          <dd>{formatarData(cliente.data_inicio_contrato)}</dd>

          <dt className="text-muted-foreground">Consultora</dt>
          <dd>{consultora?.nome ?? "-"}</dd>

          <dt className="text-muted-foreground">Próximo Marco</dt>
          <dd>
            {marco.emoji} {marco.texto}
          </dd>
        </dl>

        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-medium">Últimas Reuniões</p>
          {ultimasReunioes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma reunião registrada.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ultimasReunioes.map((reuniao) => (
                <li key={reuniao.id} className="flex items-center justify-between gap-2 text-sm">
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
      </DialogContent>
    </Dialog>
  );
}
