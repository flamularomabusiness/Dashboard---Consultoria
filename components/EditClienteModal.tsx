// Edição dos dados do cliente que moram no contrato: consultora, conselheiro(a)
// e perfil/contexto. Consultora e perfil/contexto são os mesmos campos da
// plataforma de mensalidades (editar aqui atualiza lá também); o conselheiro só
// existe no INSIGHT.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CamposContratoInsight } from "@/lib/contratos";
import { mensagemDeErro } from "@/lib/reunioes";
import type { ClienteCRM, Consultora, Contrato } from "@/lib/types";

// Radix Select não aceita value="" — este valor representa "sem consultora".
const SEM_CONSULTORA = "__sem_consultora__";

interface EditClienteModalProps {
  cliente: ClienteCRM | null;
  contrato: Contrato | null;
  consultoras: Consultora[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvar: (contratoId: string, campos: CamposContratoInsight) => Promise<void>;
}

export function EditClienteModal({
  cliente,
  contrato,
  consultoras,
  open,
  onOpenChange,
  onSalvar,
}: EditClienteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* A key remonta o formulário (estado limpo) a cada abertura/cliente. */}
        {cliente && contrato && (
          <EditClienteForm
            key={`${contrato.id}-${open}`}
            cliente={cliente}
            contrato={contrato}
            consultoras={consultoras}
            onSalvar={onSalvar}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditClienteFormProps {
  cliente: ClienteCRM;
  contrato: Contrato;
  consultoras: Consultora[];
  onSalvar: (contratoId: string, campos: CamposContratoInsight) => Promise<void>;
  onFechar: () => void;
}

function EditClienteForm({
  cliente,
  contrato,
  consultoras,
  onSalvar,
  onFechar,
}: EditClienteFormProps) {
  const [consultoraId, setConsultoraId] = React.useState(
    contrato.consultora_id ?? SEM_CONSULTORA,
  );
  const [conselheiro, setConselheiro] = React.useState(contrato.conselheiro ?? "");
  const [contexto, setContexto] = React.useState(contrato.contexto_perfil_cliente ?? "");
  const [salvando, setSalvando] = React.useState(false);

  // Só manda o que mudou, pra não sobrescrever edição feita ao mesmo tempo na plataforma.
  const campos: CamposContratoInsight = {};
  const novaConsultora = consultoraId === SEM_CONSULTORA ? null : consultoraId;
  if (novaConsultora !== (contrato.consultora_id ?? null)) campos.consultora_id = novaConsultora;
  if (conselheiro.trim() !== (contrato.conselheiro ?? "")) {
    campos.conselheiro = conselheiro.trim();
  }
  if (contexto.trim() !== (contrato.contexto_perfil_cliente ?? "").trim()) {
    campos.contexto_perfil_cliente = contexto.trim();
  }
  const houveMudanca = Object.keys(campos).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!houveMudanca) return;
    setSalvando(true);
    try {
      await onSalvar(contrato.id, campos);
      onFechar();
    } catch (erro) {
      toast.error(`Erro ao salvar dados do cliente: ${mensagemDeErro(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Editar Cliente</DialogTitle>
        <DialogDescription>{cliente.nome_razao_social}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-consultora">Consultora</Label>
          <Select value={consultoraId} onValueChange={setConsultoraId}>
            <SelectTrigger id="edit-consultora" className="w-full border-brand-blue/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_CONSULTORA}>Sem consultora</SelectItem>
              {consultoras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Sincronizado com a plataforma.</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-conselheiro">Conselheiro(a)</Label>
          <Input
            id="edit-conselheiro"
            list="sugestoes-conselheiro"
            className="border-brand-blue/40"
            placeholder="Nome do conselheiro(a)"
            value={conselheiro}
            onChange={(e) => setConselheiro(e.target.value)}
          />
          <datalist id="sugestoes-conselheiro">
            {consultoras.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Informado apenas aqui, no INSIGHT.</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-contexto">Perfil / Contexto</Label>
          <Textarea
            id="edit-contexto"
            className="min-h-28 border-brand-blue/40"
            placeholder="Perfil e contexto do cliente..."
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Sincronizado com a plataforma.</p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !houveMudanca}>
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
