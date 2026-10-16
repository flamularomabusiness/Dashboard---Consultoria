// Transferência de um cliente (fixo + reuniões futuras + contratos) para outra
// consultora. Quem decide o que realmente é movido é a RPC transferir_cliente; a
// contagem exibida aqui é só o aviso prévio, calculada com as reuniões já carregadas.
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIdentidade } from "@/lib/auth-context";
import { consultorasDestino } from "@/lib/consultoras";
import { mensagemDeErro } from "@/lib/reunioes";
import type { AgendamentoFixo, Consultora, Reuniao } from "@/lib/types";
import { dataLocalISO } from "@/lib/utils";

interface TransferirFixoModalProps {
  agendamento: AgendamentoFixo | null;
  consultoras: Consultora[];
  reunioes: Reuniao[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferir: (fixoId: string, paraConsultoraId: string) => Promise<void>;
}

export function TransferirFixoModal(props: TransferirFixoModalProps) {
  const { agendamento, open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {agendamento && (
          <TransferirForm
            key={`${agendamento.id}-${open}`}
            {...props}
            agendamento={agendamento}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferirForm({
  agendamento,
  consultoras,
  reunioes,
  onTransferir,
  onFechar,
}: TransferirFixoModalProps & { agendamento: AgendamentoFixo; onFechar: () => void }) {
  const { ehAdmin } = useIdentidade();
  const [paraId, setParaId] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  const atual = consultoras.find((c) => c.id === agendamento.consultora_id) ?? null;
  const nomeAtual = atual?.nome ?? "a consultora atual";
  // Só tipo 'consultora' (admin: + 'mentor'), menos a atual — o banco recusa o resto.
  const destinos = consultorasDestino(consultoras, ehAdmin, agendamento.consultora_id);

  const hojeISO = dataLocalISO();
  const futuras = reunioes.filter(
    (r) =>
      r.cliente_nome === agendamento.cliente_nome &&
      r.status === "agendada" &&
      r.data_reuniao > hojeISO &&
      !r.data_ata_recebida,
  ).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paraId) return;
    setSalvando(true);
    try {
      await onTransferir(agendamento.id, paraId);
      onFechar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Transferir Cliente</DialogTitle>
        <DialogDescription>
          {agendamento.cliente_nome} — hoje com {atual?.nome ?? "—"}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="transferir-para">Nova consultora</Label>
          <Select value={paraId} onValueChange={setParaId}>
            <SelectTrigger id="transferir-para" className="w-full">
              <SelectValue placeholder="Selecione a consultora" />
            </SelectTrigger>
            <SelectContent>
              {destinos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
          <p>
            Serão movidas{" "}
            <strong>
              {futuras} {futuras === 1 ? "reunião futura" : "reuniões futuras"}
            </strong>{" "}
            (agendadas, sem ATA, depois de hoje). Reuniões de hoje e atrasadas ficam com {nomeAtual}.
          </p>
          {!agendamento.cliente_id && (
            <p className="text-muted-foreground">
              Este cliente não está vinculado à plataforma; os contratos não serão alterados.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!paraId || salvando}
          className="bg-brand-green text-brand-navy hover:bg-brand-green/90"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Transferindo..." : "Transferir"}
        </Button>
      </DialogFooter>
    </form>
  );
}
