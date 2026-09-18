// Modal único reaproveitado para as 3 ações do fluxo de reunião: agendar, registrar
// que a ATA foi recebida e finalizar (arquivo editado no Drive).
"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types";

export type ReuniaoModalMode = "agendar" | "ata" | "finalizar";

interface ReuniaoModalProps {
  open: boolean;
  mode: ReuniaoModalMode;
  onOpenChange: (open: boolean) => void;
  /** Lista de clientes para o select — usada apenas no modo "agendar". */
  clientes: Cliente[];
  /** Cliente pré-selecionado quando o modal é aberto a partir de uma linha da tabela. */
  clienteSelecionado: string;
  onAgendar: (clienteNome: string, data: Date) => Promise<void>;
  onAtaRecebida: (resumoZoom: string) => Promise<void>;
  onFinalizar: (linkDrive: string) => Promise<void>;
}

const TITULOS: Record<ReuniaoModalMode, string> = {
  agendar: "Agendar Reunião",
  ata: "ATA Recebida",
  finalizar: "Finalizar Reunião",
};

const DESCRICOES: Record<ReuniaoModalMode, string> = {
  agendar: "Escolha o cliente e a data da próxima reunião.",
  ata: "Registre que o e-mail com a ATA/resumo do Zoom foi recebido.",
  finalizar: "Registre o arquivo final (Word + PDF) já editado no Drive.",
};

export function ReuniaoModal({
  open,
  mode,
  onOpenChange,
  clientes,
  clienteSelecionado,
  onAgendar,
  onAtaRecebida,
  onFinalizar,
}: ReuniaoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* A key força o formulário a remontar (estado limpo) a cada nova abertura,
            em vez de sincronizar campos via useEffect + setState. */}
        <ReuniaoModalForm
          key={`${mode}-${clienteSelecionado}-${open}`}
          mode={mode}
          clientes={clientes}
          clienteSelecionado={clienteSelecionado}
          onAgendar={onAgendar}
          onAtaRecebida={onAtaRecebida}
          onFinalizar={onFinalizar}
          onFechar={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ReuniaoModalFormProps {
  mode: ReuniaoModalMode;
  clientes: Cliente[];
  clienteSelecionado: string;
  onAgendar: (clienteNome: string, data: Date) => Promise<void>;
  onAtaRecebida: (resumoZoom: string) => Promise<void>;
  onFinalizar: (linkDrive: string) => Promise<void>;
  onFechar: () => void;
}

function ReuniaoModalForm({
  mode,
  clientes,
  clienteSelecionado,
  onAgendar,
  onAtaRecebida,
  onFinalizar,
  onFechar,
}: ReuniaoModalFormProps) {
  const [cliente, setCliente] = React.useState(clienteSelecionado);
  const [data, setData] = React.useState<Date | undefined>(undefined);
  // Reaproveitado como resumo do Zoom (modo "ata") ou link do Drive (modo "finalizar").
  const [textoCampo, setTextoCampo] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      if (mode === "agendar") {
        if (!cliente || !data) return;
        await onAgendar(cliente, data);
      } else if (mode === "ata") {
        await onAtaRecebida(textoCampo);
      } else {
        if (!textoCampo) return;
        await onFinalizar(textoCampo);
      }
      onFechar();
    } finally {
      setEnviando(false);
    }
  }

  const podeSalvar =
    !enviando &&
    (mode !== "agendar" || (Boolean(cliente) && Boolean(data))) &&
    (mode !== "finalizar" || Boolean(textoCampo));

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{TITULOS[mode]}</DialogTitle>
        <DialogDescription>{DESCRICOES[mode]}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {mode === "agendar" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger id="cliente" className="w-full">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.cliente_nome} value={c.cliente_nome}>
                      {c.cliente_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Data da reunião</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !data && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {data
                      ? format(data, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    locale={ptBR}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        {mode === "ata" && (
          <div className="grid gap-2">
            <Label htmlFor="resumo-zoom">Resumo do e-mail do Zoom (opcional)</Label>
            <Textarea
              id="resumo-zoom"
              placeholder="Cole aqui o resumo recebido por e-mail, se houver..."
              value={textoCampo}
              onChange={(e) => setTextoCampo(e.target.value)}
            />
          </div>
        )}

        {mode === "finalizar" && (
          <div className="grid gap-2">
            <Label htmlFor="link-final">
              Link do arquivo final no Drive (Word + PDF)
            </Label>
            <Input
              id="link-final"
              type="url"
              required
              placeholder="https://drive.google.com/..."
              value={textoCampo}
              onChange={(e) => setTextoCampo(e.target.value)}
            />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeSalvar}>
          {enviando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
