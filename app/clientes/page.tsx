// Página de gestão de clientes: tabela com hover card de detalhes e marcos de
// relacionamento (30 dias / 3 meses de contrato).
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClienteHoverCard } from "@/components/ClienteHoverCard";
import { ClienteModal } from "@/components/ClienteModal";
import { StatusClienteBadge } from "@/components/StatusClienteBadge";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClientesCRM, mockConsultoras, mockReunioes } from "@/lib/mock-data";
import type { ClienteCRM, Consultora, Reuniao, StatusCliente } from "@/lib/types";
import { formatarData } from "@/lib/utils";
import { calcularProximoMarco, type CorMarco } from "@/lib/calcular-marcos";

const CORES_MARCO: Record<CorMarco, string> = {
  amarelo:
    "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  verde:
    "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  azul: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  neutro: "bg-muted text-muted-foreground border-border",
};

export default function ClientesPage() {
  const [clientes, setClientes] = React.useState<ClienteCRM[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const [filtroStatus, setFiltroStatus] = React.useState<StatusCliente | "todos">("todos");
  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [apenasMarcoHoje, setApenasMarcoHoje] = React.useState(false);

  const [clienteDetalhes, setClienteDetalhes] = React.useState<ClienteCRM | null>(null);
  const [modalAberto, setModalAberto] = React.useState(false);

  React.useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        if (isSupabaseConfigured && supabase) {
          const [
            { data: clientesData, error: erroClientes },
            { data: consultorasData, error: erroConsultoras },
            { data: reunioesData, error: erroReunioes },
          ] = await Promise.all([
            supabase.from("clientes").select("*").order("data_criacao", { ascending: false }),
            supabase.from("consultoras").select("*"),
            supabase.from("reunioes").select("*"),
          ]);
          if (erroClientes || erroConsultoras || erroReunioes) {
            throw erroClientes ?? erroConsultoras ?? erroReunioes;
          }
          setClientes(clientesData ?? []);
          setConsultoras(consultorasData ?? []);
          setReunioes(reunioesData ?? []);
        } else {
          setClientes(mockClientesCRM);
          setConsultoras(mockConsultoras);
          setReunioes(mockReunioes);
        }
      } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
        toast.error("Não foi possível carregar os dados reais. Exibindo dados fictícios.");
        setClientes(mockClientesCRM);
        setConsultoras(mockConsultoras);
        setReunioes(mockReunioes);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  function consultoraDoCliente(consultoraId: string | null): Consultora | null {
    if (!consultoraId) return null;
    return consultoras.find((c) => c.id === consultoraId) ?? null;
  }

  /** Últimas 3 reuniões do cliente (mais recente primeiro), casando por nome. */
  function ultimasReunioesDoCliente(cliente: ClienteCRM): Reuniao[] {
    return reunioes
      .filter((r) => r.cliente_nome === cliente.nome_razao_social)
      .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao))
      .slice(0, 3);
  }

  const clientesFiltrados = React.useMemo(() => {
    return clientes.filter((cliente) => {
      if (filtroStatus !== "todos" && cliente.status !== filtroStatus) return false;
      if (filtroConsultora !== "todas" && cliente.consultora_id !== filtroConsultora) return false;
      if (apenasMarcoHoje) {
        const marco = calcularProximoMarco(cliente.data_inicio_contrato);
        if (marco.cor !== "amarelo") return false;
      }
      return true;
    });
  }, [clientes, filtroStatus, filtroConsultora, apenasMarcoHoje]);

  function limparFiltros() {
    setFiltroStatus("todos");
    setFiltroConsultora("todas");
    setApenasMarcoHoje(false);
  }

  function abrirDetalhes(cliente: ClienteCRM) {
    setClienteDetalhes(cliente);
    setModalAberto(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gestão de Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de clientes e marcos de relacionamento
        </p>
      </header>

      {/* Filtros */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={filtroStatus}
            onValueChange={(valor) => setFiltroStatus(valor as StatusCliente | "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="INATIVO">Inativo</SelectItem>
              <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroConsultora} onValueChange={setFiltroConsultora}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Consultora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as consultoras</SelectItem>
              {consultoras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Checkbox
              id="apenas-marco-hoje"
              checked={apenasMarcoHoje}
              onCheckedChange={(valor) => setApenasMarcoHoje(valor === true)}
            />
            <Label htmlFor="apenas-marco-hoje" className="cursor-pointer font-normal">
              Mostrar apenas com marcos hoje
            </Label>
          </div>
        </div>

        <Button variant="outline" onClick={limparFiltros} className="w-full sm:w-auto">
          <X className="mr-2 size-4" />
          Limpar Filtros
        </Button>
      </section>

      {/* Tabela principal */}
      <section className="rounded-lg border">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consultora</TableHead>
                <TableHead>Últimas Reuniões</TableHead>
                <TableHead>Próximo Marco</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Carregando dados...
                  </TableCell>
                </TableRow>
              )}

              {!carregando && clientesFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}

              {!carregando &&
                clientesFiltrados.map((cliente) => {
                  const consultora = consultoraDoCliente(cliente.consultora_id);
                  const ultimasReunioes = ultimasReunioesDoCliente(cliente);
                  const marco = calcularProximoMarco(cliente.data_inicio_contrato);

                  return (
                    <TableRow key={cliente.id}>
                      <TableCell className="whitespace-nowrap">
                        <ClienteHoverCard
                          cliente={cliente}
                          consultora={consultora}
                          ultimasReunioes={ultimasReunioes}
                        >
                          {cliente.nome_razao_social}
                        </ClienteHoverCard>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cliente.cpf_cnpj_responsavel}
                      </TableCell>
                      <TableCell>
                        <StatusClienteBadge status={cliente.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {consultora?.nome ?? "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {ultimasReunioes.length === 0
                          ? "Nenhuma"
                          : `${formatarData(ultimasReunioes[0].data_reuniao)} (${ultimasReunioes.length})`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={CORES_MARCO[marco.cor]}>
                          <span aria-hidden="true">{marco.emoji}</span>
                          {marco.texto}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            title="Ver Detalhes"
                            onClick={() => abrirDetalhes(cliente)}
                          >
                            <Eye className="size-4" />
                            <span className="hidden lg:inline">Ver Detalhes</span>
                          </Button>
                          <Button size="sm" variant="outline" title="Editar (em breve)" disabled>
                            <Pencil className="size-4" />
                            <span className="hidden lg:inline">Editar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </section>

      <footer className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        Total de clientes: {clientesFiltrados.length} de {clientes.length}
      </footer>

      <ClienteModal
        cliente={clienteDetalhes}
        consultora={consultoraDoCliente(clienteDetalhes?.consultora_id ?? null)}
        ultimasReunioes={clienteDetalhes ? ultimasReunioesDoCliente(clienteDetalhes) : []}
        open={modalAberto}
        onOpenChange={setModalAberto}
      />
    </main>
  );
}
