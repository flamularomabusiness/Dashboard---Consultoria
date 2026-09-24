// Cálculo dos marcos de relacionamento de um cliente (30 dias / 3 meses de contrato).
import { differenceInCalendarDays, parseISO } from "date-fns";

export type CorMarco = "amarelo" | "verde" | "azul" | "neutro";

export interface MarcoCliente {
  emoji: string;
  texto: string;
  cor: CorMarco;
}

interface DefinicaoMarco {
  dias: number;
  label: string;
  emojiHoje: string;
}

// Marcos acompanhados, em ordem, a partir de `data_inicio_contrato`.
const MARCOS: DefinicaoMarco[] = [
  { dias: 30, label: "30 dias", emojiHoje: "🔔" },
  { dias: 90, label: "3 meses", emojiHoje: "🎉" },
];

/**
 * Calcula o marco de relacionamento a exibir para um cliente:
 * - marco atingido exatamente hoje -> destaque (amarelo) com o emoji do marco
 * - ainda falta atingir o próximo marco -> "Próximo marco em X dia(s)" (azul)
 * - todos os marcos já foram atingidos -> último marco como concluído (verde)
 * - sem `data_inicio_contrato` cadastrada -> estado neutro
 */
export function calcularProximoMarco(
  dataInicioContrato: string | null,
  hoje: Date = new Date(),
): MarcoCliente {
  if (!dataInicioContrato) {
    return { emoji: "—", texto: "Sem data de início", cor: "neutro" };
  }

  const diasDecorridos = differenceInCalendarDays(hoje, parseISO(dataInicioContrato));

  const marcoDeHoje = MARCOS.find((marco) => marco.dias === diasDecorridos);
  if (marcoDeHoje) {
    return {
      emoji: marcoDeHoje.emojiHoje,
      texto: `${marcoDeHoje.label} (HOJE)`,
      cor: "amarelo",
    };
  }

  const proximoMarco = MARCOS.find((marco) => diasDecorridos < marco.dias);
  if (proximoMarco) {
    const diasRestantes = proximoMarco.dias - diasDecorridos;
    return {
      emoji: "📅",
      texto: `Próximo marco em ${diasRestantes} dia(s)`,
      cor: "azul",
    };
  }

  const ultimoMarco = MARCOS[MARCOS.length - 1];
  return { emoji: "✅", texto: `${ultimoMarco.label} (Concluído)`, cor: "verde" };
}
