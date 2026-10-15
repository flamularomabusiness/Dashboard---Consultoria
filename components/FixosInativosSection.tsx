// Fixos desativados (só administrador): seção recolhível com "Reativar". Um fixo cujo
// cliente está inativo (ou não aparece mais) na plataforma não pode ser reativado.
"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mensagemDeErro } from "@/lib/reunioes";
import {
  clienteEstaInativo,
  type AgendamentoFixo,
  type ClientePlataforma,
  type Consultora,
} from "@/lib/types";

interface FixosInativosSectionProps {
  inativos: AgendamentoFixo[];
  consultoras: Consultora[];
  clientesPlataforma: ClientePlataforma[];
  /** false quando a lista de clientes da plataforma não carregou (não dá para checar o vínculo). */
  plataformaDisponivel: boolean;
  onReativar: (agendamento: AgendamentoFixo) => Promise<void>;
}

/** Motivo pelo qual o fixo não pode ser reativado, ou null se pode. */
function motivoBloqueio(
  fixo: AgendamentoFixo,
  clientes: ClientePlataforma[],
  plataformaDisponivel: boolean,
): string | null {
  if (!fixo.cliente_id) return null; // sem vínculo: nada a checar
  if (!plataformaDisponivel) return "não foi possível verificar o cliente na plataforma agora.";
  const cliente = clientes.find((c) => c.id === fixo.cliente_id);
  if (!cliente) return "o cliente vinculado não está mais disponível na plataforma.";
  if (clienteEstaInativo(cliente)) return "o cliente vinculado está inativo na plataforma.";
  return null;
}

export function FixosInativosSection({
  inativos,
  consultoras,
  clientesPlataforma,
  plataformaDisponivel,
  onReativar,
}: FixosInativosSectionProps) {
  const [aberta, setAberta] = React.useState(false);
  const [reativandoId, setReativandoId] = React.useState<string | null>(null);

  async function reativar(fixo: AgendamentoFixo) {
    setReativandoId(fixo.id);
    try {
      await onReativar(fixo);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setReativandoId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex items-center gap-2 self-start text-left text-lg font-bold text-heading"
      >
        {aberta ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
        Agendamentos Fixos Inativos
        <Badge variant="outline" className="font-medium">
          {inativos.length}
        </Badge>
      </button>

      {aberta && (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inativos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum agendamento fixo inativo.
                    </TableCell>
                  </TableRow>
                )}
                {inativos.map((fixo) => {
                  const bloqueio = motivoBloqueio(fixo, clientesPlataforma, plataformaDisponivel);
                  const consultora = consultoras.find((c) => c.id === fixo.consultora_id);
                  return (
                    <TableRow key={fixo.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {fixo.cliente_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{consultora?.nome ?? "-"}</TableCell>
                      <TableCell className="capitalize whitespace-nowrap">
                        {fixo.dia_semana}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fixo.horario.slice(0, 5)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fixo.inativado_por_plataforma
                          ? "Cliente inativo na plataforma"
                          : "Removido no INSIGHT"}
                        {bloqueio && (
                          <span className="mt-0.5 block text-xs text-destructive">
                            Não pode reativar: {bloqueio}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={bloqueio !== null || reativandoId !== null}
                          title={bloqueio ?? "Reativar agendamento fixo"}
                          onClick={() => void reativar(fixo)}
                        >
                          {reativandoId === fixo.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                          Reativar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
