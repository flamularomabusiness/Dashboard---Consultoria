// Edição de um agendamento fixo (dia da semana, horário e e-mail). O cliente fica
// só leitura: ele é a chave de ligação com a planilha e com as reuniões.
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CamposAgendamentoFixo } from "@/lib/agendamentos";
import { useNomeExibicao } from "@/lib/nomes-cliente-context";
import { mensagemDeErro } from "@/lib/reunioes";
import type { AgendamentoFixo, Reuniao } from "@/lib/types";
import {
  DIAS_SEMANA_GRAVADOS,
  formatarData,
  indiceDiaSemana,
  normalizarHorario,
} from "@/lib/utils";

interface EditAgendamentoFixoModalProps {
  agendamento: AgendamentoFixo | null;
  /**
   * Reunião "agendada" de hoje em diante que já foi criada para o ciclo atual deste
   * cliente. Se existir, oferece movê-la junto para o novo dia (senão ela ficaria no
   * dia antigo e a linha apareceria como "Faltando").
   */
  reuniaoDoCiclo: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvar: (
    id: string,
    campos: CamposAgendamentoFixo,
    moverReuniaoDoCiclo: boolean,
  ) => Promise<void>;
}

export function EditAgendamentoFixoModal({
  agendamento,
  reuniaoDoCiclo,
  open,
  onOpenChange,
  onSalvar,
}: EditAgendamentoFixoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {agendamento && (
          <EditForm
            key={`${agendamento.id}-${open}`}
            agendamento={agendamento}
            reuniaoDoCiclo={reuniaoDoCiclo}
            onSalvar={onSalvar}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  agendamento,
  reuniaoDoCiclo,
  onSalvar,
  onFechar,
}: {
  agendamento: AgendamentoFixo;
  reuniaoDoCiclo: Reuniao | null;
  onSalvar: EditAgendamentoFixoModalProps["onSalvar"];
  onFechar: () => void;
}) {
  const nomeExibicao = useNomeExibicao();
  const diaOriginal = DIAS_SEMANA_GRAVADOS[indiceDiaSemana(agendamento.dia_semana)];
  const horarioOriginal = agendamento.horario.slice(0, 5);

  const [dia, setDia] = React.useState<string>(diaOriginal);
  const [horario, setHorario] = React.useState(horarioOriginal);
  const [email, setEmail] = React.useState(agendamento.email_cliente ?? "");
  const [moverReuniao, setMoverReuniao] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);

  const diaMudou = dia !== diaOriginal;
  const campos: CamposAgendamentoFixo = {};
  if (diaMudou) campos.dia_semana = dia;
  if (horario !== horarioOriginal) campos.horario = normalizarHorario(horario);
  if (email.trim() !== (agendamento.email_cliente ?? "")) {
    campos.email_cliente = email.trim() || null;
  }
  const houveMudanca = Object.keys(campos).length > 0;
  const horarioValido = /^\d{2}:\d{2}$/.test(horario);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!houveMudanca || !horarioValido) return;
    setSalvando(true);
    try {
      await onSalvar(agendamento.id, campos, diaMudou && moverReuniao && reuniaoDoCiclo !== null);
      onFechar();
    } catch (erro) {
      toast.error(`Erro ao salvar agendamento fixo: ${mensagemDeErro(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Editar Agendamento Fixo</DialogTitle>
        <DialogDescription>{nomeExibicao(agendamento.cliente_nome)}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="fixo-dia">Dia da semana</Label>
          <Select value={dia} onValueChange={setDia}>
            <SelectTrigger id="fixo-dia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIAS_SEMANA_GRAVADOS.map((d) => (
                <SelectItem key={d} value={d} className="capitalize">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fixo-horario">Horário</Label>
          <Input
            id="fixo-horario"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fixo-email">E-mail do cliente (opcional)</Label>
          <Input
            id="fixo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com.br"
          />
        </div>

        {diaMudou && reuniaoDoCiclo && (
          <div className="flex items-start gap-2 rounded-lg border border-border p-3">
            <Checkbox
              id="fixo-mover"
              checked={moverReuniao}
              onCheckedChange={(v) => setMoverReuniao(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="fixo-mover" className="cursor-pointer text-sm leading-snug font-normal">
              Mover também a reunião já criada ({formatarData(reuniaoDoCiclo.data_reuniao)}) para o
              novo dia
            </Label>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A alteração vale só no INSIGHT e passa a prevalecer sobre a planilha para este cliente.
          Reuniões passadas não mudam.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!houveMudanca || !horarioValido || salvando}
          className="bg-brand-green text-brand-navy hover:bg-brand-green/90"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
