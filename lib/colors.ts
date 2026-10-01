// Paleta INSIGHT (GRUPO ROMABC x GREEN+) centralizada — espelha as CSS
// variables de app/globals.css, pra uso em lugares que precisam do valor em
// JS/inline style (ex.: SVGs, cálculo de cor de tendência) em vez de classes
// Tailwind. Prefira as classes Tailwind (bg-primary, text-heading etc.)
// sempre que possível; use isto só quando precisar do valor bruto.
export const CORES_INSIGHT = {
  azulInsight: "#001C6B",
  azulEstrategico: "#155EEF",
  verdeInsight: "#00D998",
  verdeGreenMais: "#2DB17A",
  cinzaClaro: "#F5F7FA",
  grafite: "#141B2D",
  branco: "#FFFFFF",
  pretoFundo: "#0F1419",
} as const;

export const CORES_TENDENCIA = {
  alta: CORES_INSIGHT.verdeInsight,
  baixa: "#DC2626",
  neutro: CORES_INSIGHT.cinzaClaro,
} as const;
