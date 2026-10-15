// Criação de um agendamento fixo semanal (RPC criar_agendamento_fixo, que valida a
// permissão no banco). A consultora só cria para si; o administrador escolhe a consultora.
"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
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
import { DIAS_UTEIS_GRAVADOS, type NovoAgendamentoFixoParams } from "@/lib/agendamentos";
import { clienteCombinaComBusca } from "@/lib/busca-clientes";
import { mensagemDeErro } from "@/lib/reunioes";
import type { ClientePlataforma, Consultora } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NovoAgendamentoFixoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Clientes ativos que ainda não têm fixo ativo (já filtrados por quem chama). */
  clientesElegiveis: ClientePlataforma[];
  consultoras: Consultora[];
  ehAdmin: boolean;
  /** Id da consultora do usuário logado (null para admin sem consultora). */
  consultoraLogadaId: string | null;
  onCriar: (params: NovoAgendamentoFixoParams) => Promise<void>;
}

export function NovoAgendamentoFixoModal(props: NovoAgendamentoFixoModalProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <NovoForm {...props} onFechar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NovoForm({
  clientesElegiveis,
  consultoras,
  ehAdmin,
  consultoraLogadaId,
  onCriar,
  onFechar,
}: NovoAgendamentoFixoModalProps & { onFechar: () => void }) {
  const [busca, setBusca] = React.useState("");
  const [clienteId, setClienteId] = React.useState<string | null>(null);
  const [nomeZoom, setNomeZoom] = React.useState("");
  const [zoomEditado, setZoomEditado] = React.useState(false);
  const [consultoraId, setConsultoraId] = React.useState(ehAdmin ? "" : (consultoraLogadaId ?? ""));
  const [dia, setDia] = React.useState<string>("");
  const [horario, setHorario] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  const filtrados = React.useMemo(
    () => clientesElegiveis.filter((c) => clienteCombinaComBusca(c, busca)),
    [clientesElegiveis, busca],
  );
  const selecionado = clientesElegiveis.find((c) => c.id === clienteId) ?? null;
  const semConsultoraVinculada = !ehAdmin && !consultoraLogadaId;

  function escolherCliente(c: ClientePlataforma) {
    setClienteId(c.id);
    // Sugere o nome que as consultoras usam (fantasia, senão razão social) — a menos
    // que a pessoa já tenha digitado o dela.
    if (!zoomEditado) setNomeZoom(c.nome_fantasia?.trim() || c.nome_razao_social);
  }

  const pronto =
    Boolean(clienteId) &&
    nomeZoom.trim() !== "" &&
    consultoraId !== "" &&
    dia !== "" &&
    /^\d{2}:\d{2}$/.test(horario) &&
    !semConsultoraVinculada;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pronto || !clienteId) return;
    setSalvando(true);
    try {
      await onCriar({
        clienteId,
        nomeZoom,
        consultoraId,
        diaSemana: dia as NovoAgendamentoFixoParams["diaSemana"],
        horario,
        email,
      });
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
        <DialogTitle>Novo Agendamento Fixo</DialogTitle>
        <DialogDescription>
          Reunião semanal recorrente: as reuniões são geradas automaticamente.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {semConsultoraVinculada && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            Sua conta não está vinculada a uma consultora. Peça ao administrador para vincular.
          </p>
        )}

        <div className="grid gap-2">
          <Label htmlFor="novo-fixo-busca">Cliente</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="novo-fixo-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, nome fantasia ou CNPJ..."
              className="h-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <div
            role="listbox"
            aria-label="Clientes"
            className="max-h-44 overflow-y-auto rounded-lg border border-border"
          >
            {filtrados.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {clientesElegiveis.length === 0
                  ? "Nenhum cliente ativo sem agendamento fixo."
                  : "Nenhum cliente encontrado."}
              </p>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === clienteId}
                  onClick={() => escolherCliente(c)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-accent",
                    c.id === clienteId && "bg-brand-blue/10",
                  )}
                >
                  <span className="font-medium">{c.nome_razao_social}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.nome_fantasia?.trim() ? `${c.nome_fantasia} · ` : ""}
                    {c.cpf_cnpj_responsavel}
                  </span>
                </button>
              ))
            )}
          </div>
          {selecionado && (
            <p className="text-xs text-muted-foreground">
              Selecionado:{" "}
              <strong className="text-foreground">{selecionado.nome_razao_social}</strong>
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="novo-fixo-zoom">Nome como o Zoom escreve</Label>
          <Input
            id="novo-fixo-zoom"
            value={nomeZoom}
            onChange={(e) => {
              setNomeZoom(e.target.value);
              setZoomEditado(true);
            }}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use exatamente como aparece em &lsquo;Os recursos de reunião de [Nome]&rsquo;.
          </p>
        </div>

        {ehAdmin && (
          <div className="grid gap-2">
            <Label htmlFor="novo-fixo-consultora">Consultora responsável</Label>
            <Select value={consultoraId} onValueChange={setConsultoraId}>
              <SelectTrigger id="novo-fixo-consultora" className="w-full">
                <SelectValue placeholder="Selecione a consultora" />
              </SelectTrigger>
              <SelectContent>
                {consultoras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="novo-fixo-dia">Dia da semana</Label>
            <Select value={dia} onValueChange={setDia}>
              <SelectTrigger id="novo-fixo-dia" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_UTEIS_GRAVADOS.map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="novo-fixo-horario">Horário</Label>
            <Input
              id="novo-fixo-horario"
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="novo-fixo-email">E-mail do cliente (opcional)</Label>
          <Input
            id="novo-fixo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com.br"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!pronto || salvando}
          className="bg-brand-green text-brand-navy hover:bg-brand-green/90"
        >
          {salvando && <Loader2 className="size-4 animate-spin" />}
          {salvando ? "Criando..." : "Criar agendamento"}
        </Button>
      </DialogFooter>
    </form>
  );
}
