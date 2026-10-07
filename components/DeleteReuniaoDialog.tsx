// Confirmação de exclusão de reunião — a ação é irreversível, então sempre passa por aqui.
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
import type { Reuniao } from "@/lib/types";
import { formatarData } from "@/lib/utils";

interface DeleteReuniaoDialogProps {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (reuniao: Reuniao) => Promise<void>;
}

export function DeleteReuniaoDialog({
  reuniao,
  open,
  onOpenChange,
  onConfirmar,
}: DeleteReuniaoDialogProps) {
  const nomeExibicao = useNomeExibicao();
  const [excluindo, setExcluindo] = React.useState(false);

  async function handleConfirmar() {
    if (!reuniao) return;
    setExcluindo(true);
    try {
      await onConfirmar(reuniao);
      onOpenChange(false);
    } catch (erro) {
      toast.error(`Erro ao deletar reunião: ${mensagemDeErro(erro)}`);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(valor) => !excluindo && onOpenChange(valor)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deletar Reunião</DialogTitle>
          <DialogDescription>Tem certeza? Esta ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>

        {reuniao && (
          <p className="text-sm">
            Reunião de <strong>{nomeExibicao(reuniao.cliente_nome)}</strong> em{" "}
            <strong>{formatarData(reuniao.data_reuniao)}</strong>.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={excluindo}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={excluindo}
            onClick={handleConfirmar}
            className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
          >
            {excluindo && <Loader2 className="size-4 animate-spin" />}
            {excluindo ? "Deletando..." : "Deletar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
