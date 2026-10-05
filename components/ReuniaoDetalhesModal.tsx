// Detalhes de uma reunião (aberto ao clicar nas datas da tabela): dados básicos,
// ATA & Drive, histórico das últimas reuniões do cliente e ações de editar/deletar.
"use client";

import { CalendarClock, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Reuniao, StatusReuniao } from "@/lib/types";
import { cn, diasDesde, formatarData } from "@/lib/utils";

const STATUS_CONFIG: Record<StatusReuniao, { label: string; className: string }> = {
  agendada: {
    label: "Agendada",
    className: "border-brand-blue/40 bg-brand-blue/10 text-brand-blue dark:text-brand-green",
  },
  pendente_drive: {
    label: "Pendente Drive",
    className:
      "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  finalizada: {
    label: "Finalizada",
    className:
      "border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  },
};

function StatusReuniaoBadge({ status }: { status: StatusReuniao }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}

function textoDiasDesde(dataISO: string): string {
  const dias = diasDesde(dataISO);
  if (dias === null) return "-";
  if (dias === 0) return "hoje";
  return dias > 0 ? `há ${dias} dia(s)` : `em ${Math.abs(dias)} dia(s)`;
}

interface ReuniaoDetalhesModalProps {
  reuniao: Reuniao | null;
  /** Últimas reuniões do cliente (inclui a selecionada), da mais recente pra mais antiga. */
  historico: Reuniao[];
  consultoraNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelecionar: (id: string) => void;
  onEditar: (reuniao: Reuniao) => void;
  onRemarcar: (reuniao: Reuniao) => void;
  onDeletar: (reuniao: Reuniao) => void;
}

export function ReuniaoDetalhesModal({
  reuniao,
  historico,
  consultoraNome,
  open,
  onOpenChange,
  onSelecionar,
  onEditar,
  onRemarcar,
  onDeletar,
}: ReuniaoDetalhesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {reuniao && (
          <>
            <DialogHeader>
              <DialogTitle>Detalhes da Reunião</DialogTitle>
              <DialogDescription>{reuniao.cliente_nome}</DialogDescription>
            </DialogHeader>

            <Secao titulo="Informações Básicas">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd>{reuniao.cliente_nome}</dd>
                <dt className="text-muted-foreground">Consultora</dt>
                <dd>{consultoraNome || "-"}</dd>
                <dt className="text-muted-foreground">Data</dt>
                <dd>{formatarData(reuniao.data_reuniao)}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusReuniaoBadge status={reuniao.status} />
                </dd>
              </dl>
            </Secao>

            <Secao titulo="ATA & Drive">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Resumo Zoom</dt>
                <dd className="whitespace-pre-wrap">{reuniao.resumo_zoom || "-"}</dd>
                <dt className="text-muted-foreground">Link Drive</dt>
                <dd>
                  {reuniao.arquivo_drive_link ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <a href={reuniao.arquivo_drive_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                        Abrir no Drive
                      </a>
                    </Button>
                  ) : (
                    "-"
                  )}
                </dd>
                <dt className="text-muted-foreground">ATA recebida em</dt>
                <dd>{formatarData(reuniao.data_ata_recebida)}</dd>
              </dl>
            </Secao>

            <Secao titulo="Histórico — últimas reuniões do cliente">
              <ul className="flex flex-col gap-1.5">
                {historico.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelecionar(item.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        item.id === reuniao.id
                          ? "border-brand-blue bg-brand-blue/5"
                          : "border-transparent",
                      )}
                    >
                      <span className="font-medium">{formatarData(item.data_reuniao)}</span>
                      <StatusReuniaoBadge status={item.status} />
                      <span className="text-xs text-muted-foreground">
                        {textoDiasDesde(item.data_reuniao)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Secao>

            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full text-brand-blue dark:text-blue-400 hover:scale-105 hover:bg-brand-blue/10"
                  onClick={() => onEditar(reuniao)}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
                {reuniao.status === "agendada" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full text-brand-green-alt hover:scale-105 hover:bg-brand-green/10 dark:text-brand-green"
                    onClick={() => onRemarcar(reuniao)}
                  >
                    <CalendarClock className="size-4" />
                    Remarcar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full text-destructive hover:scale-105 hover:bg-destructive/10"
                  onClick={() => onDeletar(reuniao)}
                >
                  <Trash2 className="size-4" />
                  Deletar
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
