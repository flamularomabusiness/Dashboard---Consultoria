## Dashboard de Otimização de ATAs de Reuniões

Next.js 15 + TypeScript + Supabase + shadcn/ui.

### Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem nenhuma variável de ambiente configurada, o dashboard roda inteiramente
com **dados fictícios** (`lib/mock-data.ts`) — é possível testar toda a UI
(agendar, ATA recebida, finalizar, filtros) sem Supabase nem Google Sheets.

### Conectando dados reais

1. Copie `.env.local.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: veja em
     Project Settings > API no seu projeto Supabase.
   - `GOOGLE_SHEETS_EXPORT_URL`: link de exportação CSV da planilha
     (`.../export?format=csv&gid=...`). A planilha precisa ter, na primeira
     linha, as colunas `cliente_nome`, `consultora_id`, `dia_semana` e `horario`
     (as duas últimas podem ficar em branco para um cliente sem horário fixo).
2. Rode `supabase/schema.sql` no SQL Editor do Supabase para criar as tabelas
   `consultoras`, `reunioes` e `agendamentos_fixos`. **Importante**: os valores de `consultora_id`
   na planilha (ex.: `elisa`, `glaucia`, `rosane`) precisam corresponder a um
   registro real na tabela `consultoras` para a consultora aparecer com nome
   na tabela — do contrário, o dashboard exibe o id "bruto" como fallback.
3. Reinicie `npm run dev` — o dashboard passa a usar os dados reais
   automaticamente. A cada carregamento, os agendamentos fixos da planilha
   são sincronizados para dentro de `agendamentos_fixos` no Supabase
   (insert quando o cliente ainda não tem agendamento, update quando dia/horário
   mudou) — acompanhe pelo console do navegador (`[Sync agendamentos_fixos]`).

### Estrutura

- `app/page.tsx` — dashboard principal (tabela, filtros, cards de resumo, sincronização de agendamentos fixos).
- `app/api/clientes/route.ts` — rota server-side que lê a lista de clientes do Google Sheets.
- `app/api/agendamentos-fixos/route.ts` — rota server-side que lê os agendamentos fixos do Google Sheets.
- `components/ReuniaoModal.tsx` — modal de agendar / ATA recebida / finalizar.
- `components/StatusBadge.tsx` — badge visual de status (✅/⏳/🔴).
- `lib/supabase.ts` — cliente Supabase.
- `lib/google-sheets.ts` — leitura de clientes e agendamentos fixos via export CSV do Sheets (papaparse).
- `lib/utils.ts` — cálculo de dias, status, datas e o plano de sincronização Sheets -> Supabase.
- `lib/mock-data.ts` — dados fictícios para teste.
- `supabase/schema.sql` — schema das tabelas do Supabase.
