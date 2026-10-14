// Barra de pesquisa da página /clientes. Compartilha o estado de busca do header
// (um único `busca` no contexto): digitar aqui aparece no header e vice-versa, e
// a regra de filtro é uma só. O texto só é aplicado ~200ms depois de parar de digitar.
"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

const ATRASO_DEBOUNCE_MS = 200;

interface BuscaClientesProps {
  /** Termo aplicado hoje (vem do contexto de busca). */
  valor: string;
  onChange: (termo: string) => void;
  /** "X de Y clientes" exibido ao lado da barra. */
  exibidos: number;
  total: number;
}

export function BuscaClientes({ valor, onChange, exibidos, total }: BuscaClientesProps) {
  const [texto, setTexto] = React.useState(valor);

  // Se o termo mudar por fora (ex.: campo do header, "Limpar Filtros"), acompanha.
  // Ajuste de estado durante a renderização — padrão recomendado pelo React.
  const [valorAnterior, setValorAnterior] = React.useState(valor);
  if (valor !== valorAnterior) {
    setValorAnterior(valor);
    setTexto(valor);
  }

  React.useEffect(() => {
    if (texto === valor) return;
    const id = setTimeout(() => onChange(texto), ATRASO_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [texto, valor, onChange]);

  function limpar() {
    setTexto("");
    onChange("");
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto">
      <div className="relative w-full sm:w-[420px]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nome, nome fantasia ou CNPJ..."
          aria-label="Buscar clientes"
          className="h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto && (
          <button
            type="button"
            onClick={limpar}
            aria-label="Limpar busca"
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <span className="text-sm whitespace-nowrap text-muted-foreground" aria-live="polite">
        {exibidos} de {total} clientes
      </span>
    </div>
  );
}
