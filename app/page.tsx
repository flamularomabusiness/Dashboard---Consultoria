// Dashboard principal: tabela de clientes, filtros e ações de reunião/ATA.
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Unlink,
  Users,
} from "lucide-react";

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
import { FilterPill } from "@/components/FilterPill";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ReuniaoModal, type ReuniaoModalMode } from "@/components/ReuniaoModal";
import { DeleteReuniaoDialog } from "@/components/DeleteReuniaoDialog";
import { EditReuniaoModal } from "@/components/EditReuniaoModal";
import { RemarcarReuniaoModal } from "@/components/RemarcarReuniaoModal";
import { ReuniaoDetalhesModal } from "@/components/ReuniaoDetalhesModal";
import { DeleteAgendamentoFixoDialog } from "@/components/DeleteAgendamentoFixoDialog";
import { EditAgendamentoFixoModal } from "@/components/EditAgendamentoFixoModal";
import { FixosInativosSection } from "@/components/FixosInativosSection";
import { NovoAgendamentoFixoModal } from "@/components/NovoAgendamentoFixoModal";
import { TransferirFixoModal } from "@/components/TransferirFixoModal";
import {
  atualizarAgendamentoFixo,
  criarAgendamentoFixo,
  desativarAgendamentoFixo,
  reativarAgendamentoFixo,
  sincronizarAgendamentosComSheets,
  transferirCliente,
  type CamposAgendamentoFixo,
  type NovoAgendamentoFixoParams,
} from "@/lib/agendamentos";
import { useIdentidade } from "@/lib/auth-context";
import { consultorasParaFiltro } from "@/lib/consultoras";
import {
  atualizarReuniao,
  deletarReuniao,
  historicoDoCliente,
  type CamposReuniao,
} from "@/lib/reunioes";
import { useBusca } from "@/lib/search-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { syncAgendamentosFixosToReunioes } from "@/lib/sync-reunioes";
import type {
  AgendamentoFixo,
  AgendamentoFixoSheet,
  Cliente,
  ClientePlataforma,
  Consultora,
  LinhaAgendamentoFixo,
  LinhaCliente,
  Reuniao,
  StatusReuniao,
  StatusReuniaoCalculado,
} from "@/lib/types";
import { clienteEstaInativo } from "@/lib/types";
import {
  calcularStatsReunioes,
  calcularStatusReuniao,
  dataLocalISO,
  diasDesde,
  estaNaSemanaAtual,
  formatarData,
  obterSemanaAtual,
  proximaOcorrenciaDiaSemana,
  resolverConsultoraId,
  reuniaoEmFoco,
  separarUltimaEProximaReuniao,
} from "@/lib/utils";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";

// Colunas que o dashboard precisa da view dash_clientes (só para escolher cliente ao criar um fixo).
const COLUNAS_DASH_CLIENTES = "id,nome_razao_social,nome_fantasia,cpf_cnpj_responsavel,status,ativo";

interface ModalState {
  open: boolean;
  mode: ReuniaoModalMode;
  clienteNome: string;
  reuniaoId: string | null;
}

export default function DashboardPage() {
  const { busca } = useBusca();
  const { ehAdmin, consultoraId: minhaConsultoraId } = useIdentidade();
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [agendamentosFixos, setAgendamentosFixos] = React.useState<AgendamentoFixo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  /** Mensagem quando algo essencial não carregou (a tela mostra o erro, nunca dados de teste). */
  const [erroCarga, setErroCarga] = React.useState<string | null>(null);
  const [clientesPlataforma, setClientesPlataforma] = React.useState<ClientePlataforma[]>([]);
  const [plataformaIndisponivel, setPlataformaIndisponivel] = React.useState(false);

  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [filtroStatus, setFiltroStatus] = React.useState<StatusReuniaoCalculado | "todos">("todos");
  const [apenasSemReuniaoSemana, setApenasSemReuniaoSemana] = React.useState(false);
  const [apenasFaltandoSemana, setApenasFaltandoSemana] = React.useState(false);
  const [apenasAtrasados, setApenasAtrasados] = React.useState(false);
  const [apenasFaltando, setApenasFaltando] = React.useState(false);

  const [modal, setModal] = React.useState<ModalState>({
    open: false,
    mode: "agendar",
    clienteNome: "",
    reuniaoId: null,
  });

  // Modais de CRUD guardam só o id: a reunião é lida do estado `reunioes`, então
  // edições aparecem na hora e uma reunião deletada fecha o modal sozinha.
  const [detalhesId, setDetalhesId] = React.useState<string | null>(null);
  const [edicaoId, setEdicaoId] = React.useState<string | null>(null);
  const [remarcarId, setRemarcarId] = React.useState<string | null>(null);
  const [exclusaoId, setExclusaoId] = React.useState<string | null>(null);
  const [edicaoFixoId, setEdicaoFixoId] = React.useState<string | null>(null);
  const [exclusaoFixoId, setExclusaoFixoId] = React.useState<string | null>(null);
  const [transferirFixoId, setTransferirFixoId] = React.useState<string | null>(null);
  const [novoFixoAberto, setNovoFixoAberto] = React.useState(false);
  const agendamentoFixoPorId = (id: string | null) =>
    agendamentosFixos.find((a) => a.id === id) ?? null;
  const reuniaoPorId = (id: string | null) => reunioes.find((r) => r.id === id) ?? null;
  const reuniaoDetalhes = reuniaoPorId(detalhesId);

  /**
   * Carrega clientes e fixos da planilha (Google Sheets, via rotas do servidor), e
   * consultoras / reuniões / agendamentos fixos / clientes da plataforma (Supabase).
   * Sincroniza os fixos da planilha e gera as reuniões que ainda não existem.
   *
   * SEM fallback fictício: se algo essencial falha, a tela mostra qual parte falhou
   * (com "Tentar novamente") em vez de se encher de clientes de teste. Os clientes da
   * plataforma (view dash_clientes) só servem para criar/reativar fixos, então a falha
   * deles é parcial e não derruba o resto.
   * `silencioso` recarrega sem trocar a tela por "Carregando..." (após criar/transferir).
   */
  const carregarDados = React.useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCarregando(true);
      setErroCarga(null);
    }
    try {
      if (!isSupabaseConfigured || !supabase) {
        setErroCarga("Não foi possível carregar os dados: o Supabase não está configurado.");
        return;
      }

      const [respostaClientes, respostaFixosSheet, rConsultoras, rReunioes, rFixos, rPlataforma] =
        await Promise.all([
          fetchAutenticado("/api/clientes").catch(() => null),
          fetchAutenticado("/api/agendamentos-fixos").catch(() => null),
          supabase.from("consultoras").select("id,nome,tipo"),
          supabase.from("reunioes").select("*"),
          supabase.from("agendamentos_fixos").select("*"),
          supabase.from("dash_clientes").select(COLUNAS_DASH_CLIENTES),
        ]);

      // Cada consulta é conferida separada para dizer QUAL falhou (detalhe técnico só no console).
      const falhas: string[] = [];
      let clientesDaSheet: Cliente[] = [];
      try {
        if (!respostaClientes?.ok) {
          throw new Error(`status ${respostaClientes?.status ?? "sem resposta"}`);
        }
        clientesDaSheet = await respostaClientes.json();
      } catch (erro) {
        console.error("Erro ao carregar clientes (planilha):", erro);
        falhas.push("clientes (planilha)");
      }
      if (rConsultoras.error) {
        console.error("Erro ao carregar consultoras:", rConsultoras.error);
        falhas.push("consultoras");
      }
      if (rReunioes.error) {
        console.error("Erro ao carregar reuniões:", rReunioes.error);
        falhas.push("reuniões");
      }
      if (rFixos.error) {
        console.error("Erro ao carregar agendamentos fixos:", rFixos.error);
        falhas.push("agendamentos fixos");
      }
      if (falhas.length > 0) {
        setErroCarga(`Não foi possível carregar: ${falhas.join(", ")}.`);
        return;
      }
      setErroCarga(null);

      if (rPlataforma.error) {
        console.error("Erro ao carregar clientes da plataforma:", rPlataforma.error);
        setPlataformaIndisponivel(true);
        setClientesPlataforma([]);
      } else {
        setPlataformaIndisponivel(false);
        setClientesPlataforma((rPlataforma.data ?? []) as ClientePlataforma[]);
      }

      // Fixos da planilha só servem para sincronizar; sem planilha, segue só com o banco.
      let agendamentosSheetPayload: { configurado: boolean; agendamentos: AgendamentoFixoSheet[] } = {
        configurado: false,
        agendamentos: [],
      };
      if (respostaFixosSheet?.ok) {
        agendamentosSheetPayload = await respostaFixosSheet.json();
      }

      const consultorasCarregadas = (rConsultoras.data ?? []) as Consultora[];
      const reunioesCarregadas = (rReunioes.data ?? []) as Reuniao[];
      const fixosCarregados = (rFixos.data ?? []) as AgendamentoFixo[];
      setConsultoras(consultorasCarregadas);
      // A planilha traz o nome da consultora, não o id (ver comentário em
      // sincronizarAgendamentosComSheets) — resolve aqui também pra
      // filtro/exibição por consultora funcionarem para esses clientes.
      setClientes(
        clientesDaSheet.map((c) => ({
          ...c,
          consultora_id:
            resolverConsultoraId(c.consultora_id, consultorasCarregadas) ?? c.consultora_id,
        })),
      );

      // Só sincroniza (grava no Supabase) quando a planilha real respondeu agora.
      const agendamentosSincronizados = agendamentosSheetPayload.configurado
        ? await sincronizarAgendamentosComSheets(
            agendamentosSheetPayload.agendamentos,
            fixosCarregados,
            consultorasCarregadas,
          )
        : fixosCarregados;
      setAgendamentosFixos(agendamentosSincronizados);

      setReunioes(reunioesCarregadas);
      const resultadoSync = await syncAgendamentosFixosToReunioes(
        agendamentosSincronizados,
        reunioesCarregadas,
      );
      if (resultadoSync.inseridas > 0) {
        const { data: reunioesAtualizadas } = await supabase.from("reunioes").select("*");
        setReunioes((reunioesAtualizadas ?? reunioesCarregadas) as Reuniao[]);
      }
    } catch (erro) {
      console.error("Erro ao carregar dados:", erro);
      setErroCarga("Não foi possível carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial (a tela já nasce em "carregando"). Adiada com setTimeout para o estado não
  // ser atualizado de forma síncrona dentro do efeito.
  React.useEffect(() => {
    const id = setTimeout(() => void carregarDados(true), 0);
    return () => clearTimeout(id);
  }, [carregarDados]);

  // Filtro "Todas as consultoras": as de tipo 'consultora' + qualquer responsável que tenha
  // clientes, reuniões ou fixos (mentor/bpo com carteira não pode sumir do filtro).
  const consultorasFiltro = React.useMemo(
    () =>
      consultorasParaFiltro(consultoras, [
        ...clientes.map((c) => c.consultora_id),
        ...reunioes.map((r) => r.consultora_id),
        ...agendamentosFixos.map((a) => a.consultora_id),
      ]),
    [consultoras, clientes, reunioes, agendamentosFixos],
  );

  // Reuniões canceladas (cliente inativado na plataforma) não contam como realizadas,
  // pendentes nem "Marcada": todas as contas da tela partem desta lista.
  const reunioesAtivas = React.useMemo(
    () => reunioes.filter((r) => r.status !== "cancelada"),
    [reunioes],
  );

  // Junta cada cliente (Sheets) com sua reunião mais recente e a próxima agendada (Supabase).
  const linhas = React.useMemo<LinhaCliente[]>(() => {
    const hoje = new Date();
    return clientes.map((cliente) => {
      const reunioesDoCliente = reunioesAtivas.filter(
        (r) => r.cliente_nome === cliente.cliente_nome,
      );
      const { ultimaReuniao, proximaReuniao } = separarUltimaEProximaReuniao(
        reunioesDoCliente,
        hoje,
      );
      const emFoco = reuniaoEmFoco(ultimaReuniao, proximaReuniao, hoje);
      return {
        cliente,
        ultimaReuniao,
        proximaReuniao,
        diasDesdeUltimaReuniao: diasDesde(ultimaReuniao?.data_reuniao, hoje),
        statusReuniao: emFoco ? calcularStatusReuniao(emFoco, hoje) : null,
      };
    });
  }, [clientes, reunioesAtivas]);

  const linhasFiltradas = React.useMemo(() => {
    const hoje = new Date();
    const domingoQueVem = addDays(hoje, 7 - hoje.getDay());
    const buscaNormalizada = busca.trim().toLowerCase();
    return linhas.filter((linha) => {
      if (
        buscaNormalizada &&
        !linha.cliente.cliente_nome.toLowerCase().includes(buscaNormalizada) &&
        !nomeConsultora(linha.cliente.consultora_id).toLowerCase().includes(buscaNormalizada)
      ) {
        return false;
      }
      if (filtroConsultora !== "todas" && linha.cliente.consultora_id !== filtroConsultora) {
        return false;
      }
      if (filtroStatus !== "todos" && linha.statusReuniao !== filtroStatus) {
        return false;
      }
      if (apenasSemReuniaoSemana) {
        const temReuniaoEstaSemana =
          estaNaSemanaAtual(linha.ultimaReuniao?.data_reuniao, hoje) ||
          estaNaSemanaAtual(linha.proximaReuniao?.data_reuniao, hoje);
        if (temReuniaoEstaSemana) return false;
      }
      const reunioesDoCliente = reunioesAtivas.filter(
        (r) => r.cliente_nome === linha.cliente.cliente_nome,
      );
      if (apenasFaltandoSemana) {
        const temFaltandoEstaSemana = reunioesDoCliente.some((r) => {
          const data = parseISO(r.data_reuniao);
          return !isBefore(data, startOfDay(hoje)) && !isBefore(domingoQueVem, data);
        });
        if (!temFaltandoEstaSemana) return false;
      }
      if (apenasAtrasados) {
        const temAtrasada = reunioesDoCliente.some(
          (r) => calcularStatusReuniao(r, hoje) === "atrasado",
        );
        if (!temAtrasada) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    linhas,
    reunioes,
    consultoras,
    busca,
    filtroConsultora,
    filtroStatus,
    apenasSemReuniaoSemana,
    apenasFaltandoSemana,
    apenasAtrasados,
  ]);

  /**
   * Stats do topo, calculados direto das reuniões já carregadas (reagem a criar,
   * editar, remarcar e deletar) e respeitando o filtro de consultora:
   * - Finalizadas / Taxa de Sucesso: só a semana atual (segunda a domingo).
   *   Taxa = finalizadas da semana / todas as reuniões da semana (qualquer status).
   * - Pendente Drive / Atrasadas: todas as datas, usando o mesmo
   *   `calcularStatusReuniao` da tabela e do modal ("atrasado" não existe no banco).
   */
  const resumo = React.useMemo(() => {
    const doFiltro =
      filtroConsultora === "todas"
        ? reunioes
        : reunioes.filter((r) => {
            const consultoraDoCliente = clientes.find(
              (c) => c.cliente_nome === r.cliente_nome,
            )?.consultora_id;
            return (consultoraDoCliente ?? r.consultora_id) === filtroConsultora;
          });
    return calcularStatsReunioes(doFiltro);
  }, [reunioes, clientes, filtroConsultora]);

  // Para cada agendamento fixo, calcula a próxima ocorrência do dia da semana
  // e verifica se já existe uma reunião registrada para essa data -> "Marcada".
  const linhasAgendamentosFixos = React.useMemo<LinhaAgendamentoFixo[]>(() => {
    const hoje = new Date();
    return agendamentosFixos
      .filter((a) => a.ativo !== false)
      .map((agendamento) => {
        const proximaOcorrencia = format(
          proximaOcorrenciaDiaSemana(agendamento.dia_semana, hoje),
          "yyyy-MM-dd",
        );
        const marcada = reunioesAtivas.some(
          (r) =>
            r.cliente_nome === agendamento.cliente_nome &&
            r.data_reuniao === proximaOcorrencia,
        );
        return {
          agendamento,
          proximaOcorrencia,
          statusSemana: marcada ? "marcada" : "faltando",
        };
      });
  }, [agendamentosFixos, reunioesAtivas]);

  /** Reuniões ainda por acontecer nesta semana (hoje até domingo) — as geradas pelos agendamentos fixos + manuais. */
  const reunioesRestantesSemana = React.useMemo(() => {
    const hoje = new Date();
    const hojeISO = dataLocalISO(hoje);
    const { fim } = obterSemanaAtual(hoje);
    return reunioes.filter(
      (r) => r.status === "agendada" && r.data_reuniao >= hojeISO && r.data_reuniao <= fim,
    ).length;
  }, [reunioes]);

  const linhasAgendamentosFiltradas = React.useMemo(() => {
    if (!apenasFaltando) return linhasAgendamentosFixos;
    return linhasAgendamentosFixos.filter((linha) => linha.statusSemana === "faltando");
  }, [linhasAgendamentosFixos, apenasFaltando]);

  // --- Ações: agendar reunião / registrar ATA recebida / finalizar ---

  async function agendarReuniao(clienteNome: string, data: Date) {
    const consultoraId = clientes.find((c) => c.cliente_nome === clienteNome)?.consultora_id;
    const dataISO = format(data, "yyyy-MM-dd"); // data LOCAL (toISOString converteria para UTC)

    const novaReuniao: Reuniao = {
      id: crypto.randomUUID(),
      cliente_nome: clienteNome,
      consultora_id: consultoraId ?? null,
      data_reuniao: dataISO,
      status: "agendada",
      zoom_email_recebido: false,
      data_ata_recebida: null,
      resumo_zoom: null,
      arquivo_drive_link: null,
      finalizada_em: null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data: inserida, error } = await supabase
        .from("reunioes")
        .insert({
          cliente_nome: novaReuniao.cliente_nome,
          consultora_id: novaReuniao.consultora_id,
          data_reuniao: novaReuniao.data_reuniao,
          status: novaReuniao.status,
        })
        .select()
        .single();
      if (error) throw error;
      setReunioes((atual) => [...atual, inserida as Reuniao]);
    } else {
      throw new Error("Supabase não configurado.");
    }

    toast.success(`Reunião agendada para ${clienteNome}.`);
  }

  /** Grava no Supabase e troca a linha no estado pela versão devolvida pelo banco. */
  async function aplicarAtualizacao(reuniaoId: string, campos: CamposReuniao) {
    const atualizada = await atualizarReuniao(reuniaoId, campos);
    setReunioes((atual) => atual.map((r) => (r.id === reuniaoId ? atualizada : r)));
  }

  async function salvarEdicao(reuniaoId: string, campos: CamposReuniao) {
    await aplicarAtualizacao(reuniaoId, campos);
    toast.success("Reunião atualizada com sucesso");
  }

  async function remarcarReuniao(reuniaoId: string, novaData: string) {
    await aplicarAtualizacao(reuniaoId, { data_reuniao: novaData });
    toast.success(`Reunião remarcada para ${formatarData(novaData)}`);
  }

  async function excluirReuniao(reuniao: Reuniao) {
    await deletarReuniao(reuniao.id);
    setReunioes((atual) => atual.filter((r) => r.id !== reuniao.id));
    if (detalhesId === reuniao.id) setDetalhesId(null);
    toast.success("Reunião deletada com sucesso");
  }

  async function registrarAtaRecebida(reuniaoId: string, resumo: string) {
    const status: StatusReuniao = "pendente_drive";
    await aplicarAtualizacao(reuniaoId, {
      status,
      zoom_email_recebido: true,
      resumo_zoom: resumo || null,
      data_ata_recebida: new Date().toISOString(),
    });
    toast.success("ATA registrada como recebida. Pendente Drive.");
  }

  async function finalizarReuniao(reuniaoId: string, linkDrive: string) {
    const status: StatusReuniao = "finalizada";
    await aplicarAtualizacao(reuniaoId, {
      status,
      arquivo_drive_link: linkDrive,
      finalizada_em: new Date().toISOString(),
    });
    toast.success("Reunião finalizada com sucesso.");
  }

  // --- Agendamentos fixos: editar / remover ---

  /** Reunião "agendada" de hoje até 6 dias à frente do cliente — a do ciclo atual do horário fixo. */
  function reuniaoDoCicloDe(agendamento: AgendamentoFixo | null): Reuniao | null {
    if (!agendamento) return null;
    const hoje = new Date();
    const hojeISO = dataLocalISO(hoje);
    const limiteISO = dataLocalISO(addDays(hoje, 6));
    return (
      reunioes
        .filter(
          (r) =>
            r.cliente_nome === agendamento.cliente_nome &&
            r.status === "agendada" &&
            r.data_reuniao >= hojeISO &&
            r.data_reuniao <= limiteISO,
        )
        .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao))[0] ?? null
    );
  }

  async function salvarAgendamentoFixo(
    id: string,
    campos: CamposAgendamentoFixo,
    moverReuniaoDoCiclo: boolean,
  ) {
    const reuniaoDoCiclo = moverReuniaoDoCiclo ? reuniaoDoCicloDe(agendamentoFixoPorId(id)) : null;
    const atualizado = await atualizarAgendamentoFixo(id, campos);
    setAgendamentosFixos((atual) => atual.map((a) => (a.id === id ? atualizado : a)));

    if (reuniaoDoCiclo && campos.dia_semana) {
      const novaData = format(proximaOcorrenciaDiaSemana(campos.dia_semana), "yyyy-MM-dd");
      await aplicarAtualizacao(reuniaoDoCiclo.id, { data_reuniao: novaData });
    }
    toast.success("Agendamento fixo atualizado");
  }

  async function removerAgendamentoFixo(agendamento: AgendamentoFixo) {
    await desativarAgendamentoFixo(agendamento.id);
    setAgendamentosFixos((atual) =>
      atual.map((a) => (a.id === agendamento.id ? { ...a, ativo: false } : a)),
    );
    toast.success("Agendamento fixo removido");
  }

  /** Admin gerencia todos; consultora só os fixos dela (o banco valida de verdade — isto só esconde botões). */
  function podeGerenciarFixo(fixo: AgendamentoFixo): boolean {
    return ehAdmin || (minhaConsultoraId !== null && fixo.consultora_id === minhaConsultoraId);
  }

  const fixosInativos = agendamentosFixos.filter((a) => a.ativo === false);

  // Clientes ativos da plataforma que ainda não têm fixo ativo (a view já limita a consultora aos dela).
  const clientesElegiveis = React.useMemo(() => {
    const comFixoAtivo = new Set(
      agendamentosFixos.filter((a) => a.ativo !== false && a.cliente_id).map((a) => a.cliente_id),
    );
    return clientesPlataforma.filter((c) => !clienteEstaInativo(c) && !comFixoAtivo.has(c.id));
  }, [clientesPlataforma, agendamentosFixos]);

  async function criarFixo(params: NovoAgendamentoFixoParams) {
    await criarAgendamentoFixo(params);
    toast.success("Agendamento fixo criado");
    // Recarrega: roda a geração de reuniões já existente e traz o fixo e as reuniões novas.
    await carregarDados(true);
  }

  async function transferirFixo(fixoId: string, paraConsultoraId: string) {
    const resultado = await transferirCliente(fixoId, paraConsultoraId);
    const reunioesTxt = resultado.reunioes === 1 ? "reunião" : "reuniões";
    const contratosTxt = resultado.contratos === 1 ? "contrato" : "contratos";
    toast.success(
      `${resultado.reunioes} ${reunioesTxt} e ${resultado.contratos} ${contratosTxt} atualizados`,
    );
    await carregarDados(true);
  }

  async function reativarFixo(fixo: AgendamentoFixo) {
    await reativarAgendamentoFixo(fixo.id);
    toast.success("Agendamento fixo reativado");
    // Recarrega: a geração recria a próxima ocorrência (reuniões canceladas não bloqueiam).
    await carregarDados(true);
  }

  // --- Controle do modal ---

  function abrirAgendar(clienteNome = "") {
    setModal({ open: true, mode: "agendar", clienteNome, reuniaoId: null });
  }

  function abrirAta(linha: LinhaCliente) {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return;
    setModal({
      open: true,
      mode: "ata",
      clienteNome: linha.cliente.cliente_nome,
      reuniaoId: reuniao.id,
    });
  }

  function abrirFinalizar(linha: LinhaCliente) {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return;
    setModal({
      open: true,
      mode: "finalizar",
      clienteNome: linha.cliente.cliente_nome,
      reuniaoId: reuniao.id,
    });
  }

  /** Reunião usada para decidir as ações da linha: a última já realizada ou,
   * na falta dela, a próxima agendada (ainda sem nenhuma reunião concluída). */
  function reuniaoParaAcao(linha: LinhaCliente): Reuniao | null {
    return linha.ultimaReuniao ?? linha.proximaReuniao ?? null;
  }

  /**
   * Ações disponíveis por linha, de acordo com o status da reunião:
   * - agendada (reunião futura ou já ocorrida, ainda sem ATA) -> "ATA Recebida" + "Agendar"
   * - pendente_drive (ATA/resumo do Zoom já recebido)         -> "Finalizar"
   * - finalizada                                              -> "Ver" (link do Drive) ou "-"
   * - sem nenhuma reunião registrada ainda                    -> só "Agendar"
   */
  function acoesDaLinha(linha: LinhaCliente): Array<"agendar" | "ata" | "finalizar" | "ver"> {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return ["agendar"];

    if (reuniao.status === "agendada") return ["ata", "agendar"];
    if (reuniao.status === "finalizada") return ["ver"];
    return ["finalizar"]; // pendente_drive
  }

  /** A planilha só traz o id da consultora; aqui resolvemos o nome para exibição. */
  function nomeConsultora(consultoraId: string) {
    return consultoras.find((c) => c.id === consultoraId)?.nome ?? consultoraId;
  }

  if (erroCarga && !carregando) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-tight text-heading">Dashboard INSIGHT</h1>
        </header>
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-6"
        >
          <p className="font-semibold text-destructive">Não foi possível carregar os dados</p>
          <p className="text-sm text-muted-foreground">{erroCarga}</p>
          <Button onClick={() => void carregarDados()}>Tentar novamente</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">Dashboard INSIGHT</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe reuniões, ATAs pendentes e prazos por cliente e consultora.
        </p>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          label="Finalizadas"
          subtitle="Esta semana"
          value={resumo.finalizadasSemana}
          icon={CheckCircle2}
        />
        <StatsCard
          label="Pendente Drive"
          subtitle="Total"
          value={resumo.pendenteDrive}
          icon={FolderOpen}
        />
        <StatsCard label="Atrasadas" subtitle="Total" value={resumo.atrasadas} icon={AlertCircle} />
        <StatsCard
          label="Taxa de Sucesso"
          subtitle="Esta semana"
          value={`${resumo.taxaSucessoSemana}%`}
          icon={TrendingUp}
        />
      </section>

      {/* Filtros */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={filtroConsultora} onValueChange={setFiltroConsultora}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Consultora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as consultoras</SelectItem>
              {consultorasFiltro.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroStatus}
            onValueChange={(valor) => setFiltroStatus(valor as StatusReuniaoCalculado | "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="agendada">📅 Agendada</SelectItem>
              <SelectItem value="pendente_drive">📁 Pendente Drive</SelectItem>
              <SelectItem value="atrasado">🔴 Atrasado</SelectItem>
              <SelectItem value="finalizada">✅ Finalizada</SelectItem>
            </SelectContent>
          </Select>

          <FilterPill
            ativo={apenasSemReuniaoSemana}
            onClick={() => setApenasSemReuniaoSemana((v) => !v)}
          >
            Clientes sem reunião esta semana
          </FilterPill>

          <FilterPill ativo={apenasFaltandoSemana} onClick={() => setApenasFaltandoSemana((v) => !v)}>
            Só faltando esta semana
          </FilterPill>

          <FilterPill ativo={apenasAtrasados} onClick={() => setApenasAtrasados((v) => !v)}>
            Só atrasados
          </FilterPill>
        </div>

        <Button onClick={() => abrirAgendar()} className="w-full sm:w-auto">
          <CalendarPlus className="mr-2 size-4" />
          Nova Reunião
        </Button>
      </section>

      {/* Tabela principal */}
      <section className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Consultora</TableHead>
                <TableHead>Última Reunião</TableHead>
                <TableHead>Dias desde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próxima Reunião</TableHead>
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

              {!carregando && linhasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}

              {!carregando &&
                linhasFiltradas.map((linha) => {
                  const acoes = acoesDaLinha(linha);
                  const alvo = reuniaoParaAcao(linha);
                  // Só reunião ainda "agendada" pode ser remarcada; a próxima tem prioridade.
                  const alvoRemarcar =
                    [linha.proximaReuniao, linha.ultimaReuniao].find(
                      (r) => r?.status === "agendada",
                    ) ?? null;
                  const totalReunioes = reunioesAtivas.filter(
                    (r) => r.cliente_nome === linha.cliente.cliente_nome,
                  ).length;
                  return (
                    <TableRow key={linha.cliente.cliente_nome}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {linha.cliente.cliente_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {nomeConsultora(linha.cliente.consultora_id)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DataClicavel reuniao={linha.ultimaReuniao} onClick={setDetalhesId} />
                        {totalReunioes > 0 && (
                          <span className="ml-1 text-muted-foreground">({totalReunioes})</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {linha.diasDesdeUltimaReuniao === null
                          ? "Nunca"
                          : `${linha.diasDesdeUltimaReuniao} dia(s)`}
                      </TableCell>
                      <TableCell>
                        {linha.statusReuniao ? (
                          <StatusBadge status={linha.statusReuniao} />
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem reunião</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DataClicavel reuniao={linha.proximaReuniao} onClick={setDetalhesId} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {acoes.includes("ata") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Registrar ATA recebida"
                              onClick={() => abrirAta(linha)}
                            >
                              <span aria-hidden="true">📎</span>
                              <span className="hidden 2xl:inline">ATA Recebida</span>
                            </Button>
                          )}
                          {acoes.includes("agendar") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Agendar reunião"
                              onClick={() => abrirAgendar(linha.cliente.cliente_nome)}
                            >
                              <CalendarPlus className="size-4" />
                              <span className="hidden 2xl:inline">Agendar</span>
                            </Button>
                          )}
                          {acoes.includes("finalizar") && (
                            <Button
                              size="sm"
                              className="rounded-full"
                              title="Finalizar reunião"
                              onClick={() => abrirFinalizar(linha)}
                            >
                              <span aria-hidden="true">✅</span>
                              <span className="hidden 2xl:inline">Finalizar</span>
                            </Button>
                          )}
                          {acoes.includes("ver") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Ver resumo, arquivo e data"
                              onClick={() => setDetalhesId(reuniaoParaAcao(linha)?.id ?? null)}
                            >
                              <span aria-hidden="true">📁</span>
                              <span className="hidden 2xl:inline">Ver</span>
                            </Button>
                          )}
                          {alvo && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-brand-blue dark:text-blue-400 transition-transform duration-200 hover:scale-105 hover:bg-brand-blue/10 hover:text-brand-blue"
                                title="Editar reunião"
                                aria-label={`Editar reunião de ${linha.cliente.cliente_nome}`}
                                onClick={() => setEdicaoId(alvo.id)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              {alvoRemarcar && (
                                <Button
                                  size="icon-sm"
                                  variant="outline"
                                  className="rounded-full text-brand-green-alt transition-transform duration-200 hover:scale-105 hover:bg-brand-green/10 hover:text-brand-green-alt dark:text-brand-green"
                                  title="Remarcar reunião"
                                  aria-label={`Remarcar reunião de ${linha.cliente.cliente_nome}`}
                                  onClick={() => setRemarcarId(alvoRemarcar.id)}
                                >
                                  <CalendarClock className="size-4" />
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-destructive transition-transform duration-200 hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
                                title="Deletar reunião"
                                aria-label={`Deletar reunião de ${linha.cliente.cliente_nome}`}
                                onClick={() => setExclusaoId(alvo.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Agendamentos fixos: compromisso semanal recorrente por cliente */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-heading">Agendamentos Fixos da Semana</h2>
          <p className="text-sm text-muted-foreground">
            Próxima ocorrência de cada horário fixo e se já existe reunião marcada para ela. As
            reuniões são geradas automaticamente a partir da planilha.
          </p>
          <p className="text-sm font-medium">
            Reuniões ainda por acontecer esta semana:{" "}
            <span className="text-heading">{reunioesRestantesSemana}</span>
          </p>
        </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              onClick={() => setNovoFixoAberto(true)}
              disabled={plataformaIndisponivel}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 size-4" />
              Novo agendamento fixo
            </Button>
            {plataformaIndisponivel && (
              <p className="text-xs text-destructive">
                Clientes da plataforma indisponíveis no momento.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="apenas-faltando"
            checked={apenasFaltando}
            onCheckedChange={(valor) => setApenasFaltando(valor === true)}
          />
          <Label htmlFor="apenas-faltando" className="cursor-pointer font-normal">
            Mostrar só faltando
          </Label>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Próxima Reunião</TableHead>
                  <TableHead>Status da Semana</TableHead>
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

                {!carregando && linhasAgendamentosFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Nenhum agendamento fixo encontrado para o filtro selecionado.
                    </TableCell>
                  </TableRow>
                )}

                {!carregando &&
                  linhasAgendamentosFiltradas.map((linha) => (
                    <TableRow key={linha.agendamento.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {linha.agendamento.cliente_nome}
                        {ehAdmin && !linha.agendamento.cliente_id && (
                          <Badge
                            variant="outline"
                            title="Não será inativado automaticamente"
                            className="ml-2 gap-1 border-amber-300 bg-amber-100 align-middle text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          >
                            <Unlink className="size-3" />
                            Sem vínculo com a plataforma
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {nomeConsultora(linha.agendamento.consultora_id ?? "")}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">
                        {linha.agendamento.dia_semana}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {linha.agendamento.horario.slice(0, 5)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(linha.proximaOcorrencia)}
                      </TableCell>
                      <TableCell>
                        {linha.statusSemana === "marcada" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-green-300 bg-green-100 font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                          >
                            ✅ Marcada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-red-300 bg-red-100 font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                          >
                            🔴 Faltando
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {podeGerenciarFixo(linha.agendamento) && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-brand-blue dark:text-blue-400 transition-transform duration-200 hover:scale-105 hover:bg-brand-blue/10 hover:text-brand-blue"
                                title="Editar agendamento fixo"
                                aria-label={`Editar agendamento fixo de ${linha.agendamento.cliente_nome}`}
                                onClick={() => setEdicaoFixoId(linha.agendamento.id)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-brand-green-alt transition-transform duration-200 hover:scale-105 hover:bg-brand-green/10 hover:text-brand-green-alt dark:text-brand-green"
                                title="Transferir para outra consultora"
                                aria-label={`Transferir ${linha.agendamento.cliente_nome} para outra consultora`}
                                onClick={() => setTransferirFixoId(linha.agendamento.id)}
                              >
                                <Users className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-destructive transition-transform duration-200 hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
                                title="Remover agendamento fixo"
                                aria-label={`Remover agendamento fixo de ${linha.agendamento.cliente_nome}`}
                                onClick={() => setExclusaoFixoId(linha.agendamento.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {ehAdmin && (
        <FixosInativosSection
          inativos={fixosInativos}
          consultoras={consultoras}
          clientesPlataforma={clientesPlataforma}
          plataformaDisponivel={!plataformaIndisponivel}
          onReativar={reativarFixo}
        />
      )}

      <ReuniaoModal
        open={modal.open}
        mode={modal.mode}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        clientes={clientes}
        clienteSelecionado={modal.clienteNome}
        onAgendar={agendarReuniao}
        onAtaRecebida={(link) => registrarAtaRecebida(modal.reuniaoId!, link)}
        onFinalizar={(link) => finalizarReuniao(modal.reuniaoId!, link)}
      />

      <ReuniaoDetalhesModal
        reuniao={reuniaoDetalhes}
        historico={
          reuniaoDetalhes ? historicoDoCliente(reunioes, reuniaoDetalhes.cliente_nome) : []
        }
        consultoraNome={nomeConsultora(reuniaoDetalhes?.consultora_id ?? "")}
        open={reuniaoDetalhes !== null}
        onOpenChange={(open) => !open && setDetalhesId(null)}
        onSelecionar={setDetalhesId}
        onEditar={(r) => setEdicaoId(r.id)}
        onRemarcar={(r) => setRemarcarId(r.id)}
        onDeletar={(r) => setExclusaoId(r.id)}
      />

      <EditReuniaoModal
        reuniao={reuniaoPorId(edicaoId)}
        open={reuniaoPorId(edicaoId) !== null}
        onOpenChange={(open) => !open && setEdicaoId(null)}
        clientes={clientes}
        onSalvar={salvarEdicao}
      />

      <RemarcarReuniaoModal
        reuniao={reuniaoPorId(remarcarId)}
        open={reuniaoPorId(remarcarId) !== null}
        onOpenChange={(open) => !open && setRemarcarId(null)}
        onRemarcar={remarcarReuniao}
      />

      <NovoAgendamentoFixoModal
        open={novoFixoAberto}
        onOpenChange={setNovoFixoAberto}
        clientesElegiveis={clientesElegiveis}
        consultoras={consultoras}
        ehAdmin={ehAdmin}
        consultoraLogadaId={minhaConsultoraId}
        onCriar={criarFixo}
      />

      <TransferirFixoModal
        agendamento={agendamentoFixoPorId(transferirFixoId)}
        consultoras={consultoras}
        reunioes={reunioes}
        open={agendamentoFixoPorId(transferirFixoId) !== null}
        onOpenChange={(open) => !open && setTransferirFixoId(null)}
        onTransferir={transferirFixo}
      />

      <EditAgendamentoFixoModal
        agendamento={agendamentoFixoPorId(edicaoFixoId)}
        reuniaoDoCiclo={reuniaoDoCicloDe(agendamentoFixoPorId(edicaoFixoId))}
        open={agendamentoFixoPorId(edicaoFixoId) !== null}
        onOpenChange={(open) => !open && setEdicaoFixoId(null)}
        onSalvar={salvarAgendamentoFixo}
      />

      <DeleteAgendamentoFixoDialog
        agendamento={agendamentoFixoPorId(exclusaoFixoId)}
        open={agendamentoFixoPorId(exclusaoFixoId) !== null}
        onOpenChange={(open) => !open && setExclusaoFixoId(null)}
        onConfirmar={removerAgendamentoFixo}
      />

      <DeleteReuniaoDialog
        reuniao={reuniaoPorId(exclusaoId)}
        open={reuniaoPorId(exclusaoId) !== null}
        onOpenChange={(open) => !open && setExclusaoId(null)}
        onConfirmar={excluirReuniao}
      />
    </main>
  );
}

/** Data de uma reunião como botão: abre o modal de detalhes daquela reunião. */
function DataClicavel({
  reuniao,
  onClick,
}: {
  reuniao: Reuniao | null;
  onClick: (id: string) => void;
}) {
  if (!reuniao) return <>-</>;
  return (
    <button
      type="button"
      onClick={() => onClick(reuniao.id)}
      title="Ver detalhes da reunião"
      className="cursor-pointer rounded-sm font-medium underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {formatarData(reuniao.data_reuniao)}
    </button>
  );
}
