// Confirmação para remover um agendamento fixo: nenhuma reunião nova será gerada
// para o cliente. Reuniões já criadas são mantidas (histórico).
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNomeExibicao } from "@/lib/nomes-cliente-context";
import { mensagemDeErro } from "@/lib/reunioes";
import type { AgendamentoFixo } from "@/lib/types";

interface DeleteAgendamentoFixoDialogProps {
  agendamento: AgendamentoFixo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (agendamento: AgendamentoFixo) => Promise<void>;
}

export function DeleteAgendamentoFixoDialog({
  agendamento,
  open,
  onOpenChange,
  onConfirmar,
}: DeleteAgendamentoFixoDialogProps) {
  const nomeExibicao = useNomeExibicao();
  const [removendo, setRemovendo] = React.useState(false);

  async function handleConfirmar() {
    if (!agendamento) return;
    setRemovendo(true);
    try {
      await onConfirmar(agendamento);
      onOpenChange(false);
    } catch (erro) {
      toast.error(`Erro ao remover agendamento fixo: ${mensagemDeErro(erro)}`);
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(valor) => !removendo && onOpenChange(valor)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remover Agendamento Fixo</DialogTitle>
          <DialogDescription>
            O INSIGHT deixa de gerar reuniões automáticas para este cliente.
          </DialogDescription>
        </DialogHeader>

        {agendamento && (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <strong>{nomeExibicao(agendamento.cliente_nome)}</strong> —{" "}
              <span className="capitalize">{agendamento.dia_semana}</span> às{" "}
              {agendamento.horario.slice(0, 5)}.
            </p>
            <p className="text-muted-foreground">
              As reuniões que já existem (passadas e futuras) continuam na lista; apague-as
              separadamente se precisar. A planilha não recria este agendamento.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={removendo}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={removendo}
            onClick={handleConfirmar}
            className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
          >
            {removendo && <Loader2 className="size-4 animate-spin" />}
            {removendo ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
