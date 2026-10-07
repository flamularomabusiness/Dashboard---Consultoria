// Edição completa de uma reunião: cliente, data, status, resumo do Zoom e link do Drive.
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mensagemDeErro, type CamposReuniao } from "@/lib/reunioes";
import { useNomeExibicao } from "@/lib/nomes-cliente-context";
import type { Cliente, Reuniao, StatusReuniao } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_OPCOES: Array<{ valor: StatusReuniao; label: string }> = [
  { valor: "agendada", label: "Agendada" },
  { valor: "pendente_drive", label: "Pendente Drive" },
  { valor: "finalizada", label: "Finalizada" },
];

interface EditReuniaoModalProps {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  onSalvar: (id: string, campos: CamposReuniao) => Promise<void>;
}

export function EditReuniaoModal({
  reuniao,
  open,
  onOpenChange,
  clientes,
  onSalvar,
}: EditReuniaoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* A key remonta o formulário (estado limpo) a cada abertura/reunião. */}
        {reuniao && (
          <EditReuniaoForm
            key={`${reuniao.id}-${open}`}
            reuniao={reuniao}
            clientes={clientes}
            onSalvar={onSalvar}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditReuniaoFormProps {
  reuniao: Reuniao;
  clientes: Cliente[];
  onSalvar: (id: string, campos: CamposReuniao) => Promise<void>;
  onFechar: () => void;
}

function EditReuniaoForm({ reuniao, clientes, onSalvar, onFechar }: EditReuniaoFormProps) {
  const nomeExibicao = useNomeExibicao();
  const [clienteNome, setClienteNome] = React.useState(reuniao.cliente_nome);
  const [data, setData] = React.useState<Date | undefined>(parseISO(reuniao.data_reuniao));
  const [status, setStatus] = React.useState<StatusReuniao>(reuniao.status);
  const [resumo, setResumo] = React.useState(reuniao.resumo_zoom ?? "");
  const [link, setLink] = React.useState(reuniao.arquivo_drive_link ?? "");
  const [salvando, setSalvando] = React.useState(false);

  // Garante que o cliente atual aparece no select mesmo se não estiver mais na planilha.
  const nomesClientes = Array.from(
    new Set([reuniao.cliente_nome, ...clientes.map((c) => c.cliente_nome)]),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteNome || !data) {
      toast.error("Informe o cliente e a data da reunião.");
      return;
    }
    if (status === "finalizada" && !link.trim()) {
      toast.error("Para finalizar, informe o link do Drive (Word + PDF).");
      return;
    }

    const agora = new Date().toISOString();
    const campos: CamposReuniao = {
      cliente_nome: clienteNome,
      data_reuniao: format(data, "yyyy-MM-dd"),
      status,
      resumo_zoom: resumo.trim() || null,
      arquivo_drive_link: link.trim() || null,
    };

    if (clienteNome !== reuniao.cliente_nome) {
      const novaConsultora = clientes.find((c) => c.cliente_nome === clienteNome)?.consultora_id;
      if (novaConsultora) campos.consultora_id = novaConsultora;
    }

    // Mantém os campos de fluxo coerentes com o status escolhido.
    if (status !== reuniao.status) {
      if (status === "agendada") {
        campos.finalizada_em = null;
      } else if (status === "pendente_drive") {
        campos.zoom_email_recebido = true;
        campos.data_ata_recebida = reuniao.data_ata_recebida ?? agora;
        campos.finalizada_em = null;
      } else {
        campos.finalizada_em = reuniao.finalizada_em ?? agora;
      }
    }

    setSalvando(true);
    try {
      await onSalvar(reuniao.id, campos);
      onFechar();
    } catch (erro) {
      toast.error(`Erro ao atualizar reunião: ${mensagemDeErro(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Editar Reunião</DialogTitle>
        <DialogDescription>Altere os dados da reunião e salve.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-cliente">Cliente</Label>
          <Select value={clienteNome} onValueChange={setClienteNome}>
            <SelectTrigger id="edit-cliente" className="w-full border-brand-blue/40">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {nomesClientes.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nomeExibicao(nome)}
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
                  "w-full justify-start border-brand-blue/40 text-left font-normal",
                  !data && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={data} onSelect={setData} locale={ptBR} autoFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusReuniao)}>
            <SelectTrigger id="edit-status" className="w-full border-brand-blue/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPCOES.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-resumo">Resumo do Zoom (opcional)</Label>
          <Textarea
            id="edit-resumo"
            className="border-brand-blue/40"
            placeholder="Resumo recebido por e-mail, se houver..."
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-link">
            Link do Drive {status === "finalizada" ? "(obrigatório)" : "(opcional)"}
          </Label>
          <Input
            id="edit-link"
            type="url"
            className="border-brand-blue/40"
            placeholder="https://drive.google.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
