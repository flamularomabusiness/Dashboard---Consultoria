// Card de um cliente no grid de /clientes. O card inteiro é clicável (abre o
// modal de detalhes); o botão "Ver Detalhes" é só um alvo de clique explícito
// pra quem prefere mirar nele (ou navega por teclado/leitor de tela).
"use client";

import * as React from "react";
import { Eye, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { ClienteHoverCard } from "@/components/ClienteHoverCard";
import { StatusClienteBadge } from "@/components/StatusClienteBadge";
import type { ClienteCRM, Consultora, Reuniao } from "@/lib/types";
import { cn, formatarData } from "@/lib/utils";
import { calcularProximoMarco, type CorMarco } from "@/lib/calcular-marcos";

const CORES_MARCO: Record<CorMarco, string> = {
  amarelo:
    "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  verde:
    "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  azul: "border-brand-blue/30 bg-brand-blue/10 text-brand-navy dark:text-brand-green",
  neutro: "bg-muted text-muted-foreground border-border",
};

interface ClienteCardProps {
  cliente: ClienteCRM;
  consultora: Consultora | null;
  /** Já filtradas pelo cliente e ordenadas da mais recente para a mais antiga. */
  ultimasReunioes: Reuniao[];
  onVerDetalhes: () => void;
  onEditar: () => void;
}

export function ClienteCard({
  cliente,
  consultora,
  ultimasReunioes,
  onVerDetalhes,
  onEditar,
}: ClienteCardProps) {
  const marco = calcularProximoMarco(cliente.data_inicio_contrato);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onVerDetalhes}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onVerDetalhes();
        }
      }}
      className="cursor-pointer border border-brand-blue/30 transition-all duration-200 hover:-translate-y-1 hover:border-brand-green hover:shadow-lg"
    >
      <CardHeader>
        <div className="min-w-0">
          <ClienteHoverCard
            cliente={cliente}
            consultora={consultora}
            ultimasReunioes={ultimasReunioes}
          >
            <span className="truncate text-base font-bold text-heading">
              {cliente.nome_razao_social}
            </span>
          </ClienteHoverCard>
          <p className="truncate font-mono text-[13px] text-muted-foreground">
            {cliente.cpf_cnpj_responsavel}
          </p>
        </div>
        <CardAction>
          <StatusClienteBadge status={cliente.status} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col">
        <InfoRow label="Consultora">{consultora?.nome ?? "-"}</InfoRow>
        <InfoRow label="Últimas Reuniões">
          {ultimasReunioes.length === 0
            ? "Nenhuma"
            : `${formatarData(ultimasReunioes[0].data_reuniao)} (${ultimasReunioes.length})`}
        </InfoRow>
        <InfoRow label="Próximo Marco">
          <Badge variant="outline" className={cn("whitespace-nowrap", CORES_MARCO[marco.cor])}>
            <span aria-hidden="true">{marco.emoji}</span>
            {marco.texto}
          </Badge>
        </InfoRow>

        <div className="flex gap-2 pt-3">
          <Button
            size="sm"
            className="flex-1 rounded-full border-none bg-gradient-to-r from-brand-blue to-brand-green text-white hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              onVerDetalhes();
            }}
          >
            <Eye className="size-4" />
            Ver Detalhes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            title="Editar consultora, conselheiro e perfil"
            aria-label={`Editar dados de ${cliente.nome_razao_social}`}
            onClick={(e) => {
              e.stopPropagation();
              onEditar();
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 truncate text-right text-sm font-medium">{children}</div>
    </div>
  );
}
