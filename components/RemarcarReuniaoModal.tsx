// Remarcação rápida: só troca a data da reunião (para mudar mais coisas, use "Editar").
"use client";

import * as React from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mensagemDeErro } from "@/lib/reunioes";
import { useNomeExibicao } from "@/lib/nomes-cliente-context";
import type { Reuniao } from "@/lib/types";
import { cn, formatarData } from "@/lib/utils";

interface RemarcarReuniaoModalProps {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemarcar: (id: string, novaData: string) => Promise<void>;
}

export function RemarcarReuniaoModal({
  reuniao,
  open,
  onOpenChange,
  onRemarcar,
}: RemarcarReuniaoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {reuniao && (
          <RemarcarForm
            key={`${reuniao.id}-${open}`}
            reuniao={reuniao}
            onRemarcar={onRemarcar}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemarcarForm({
  reuniao,
  onRemarcar,
  onFechar,
}: {
  reuniao: Reuniao;
  onRemarcar: (id: string, novaData: string) => Promise<void>;
  onFechar: () => void;
}) {
  const nomeExibicao = useNomeExibicao();
  const [data, setData] = React.useState<Date | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);

  const novaDataISO = data ? format(data, "yyyy-MM-dd") : null;
  const podeRemarcar = Boolean(novaDataISO) && novaDataISO !== reuniao.data_reuniao && !salvando;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!novaDataISO) return;
    setSalvando(true);
    try {
      await onRemarcar(reuniao.id, novaDataISO);
      onFechar();
    } catch (erro) {
      toast.error(`Erro ao remarcar reunião: ${mensagemDeErro(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Remarcar Reunião</DialogTitle>
        <DialogDescription>
          {nomeExibicao(reuniao.cliente_nome)} — atualmente em {formatarData(reuniao.data_reuniao)}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 py-4">
        <Label>Nova data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start border-brand-blue/40 text-left font-normal",
                !data && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a nova data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={data}
              onSelect={setData}
              defaultMonth={parseISO(reuniao.data_reuniao)}
              disabled={{ before: startOfDay(new Date()) }}
              locale={ptBR}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!podeRemarcar}
          className="bg-brand-green text-brand-navy hover:bg-brand-green/90"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Remarcando..." : "Remarcar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
