-- Migration: despesas reembolsaveis (transfer).
--
-- Contexto: Julimar tem despesas durante atendimentos (estacionamento,
-- pedagio extra, gorjeta) que foram combinadas como reembolsaveis pelo
-- cliente. Ele quer:
--   1. Marcar despesa como "reembolsavel pelo cliente" na hora de lancar
--   2. Ela aparece automaticamente no relatorio consolidado do cliente
--      (soma no total a cobrar)
--   3. Quando cliente paga, marca como "reembolsada" — some do proximo
--      relatorio (evita cobrar 2x)
--
-- Padrao QuickBooks/Bling/Conta Azul (Billable + Billed states).
--
-- Colunas:
--   reembolsavel: bool DEFAULT false — despesa e reembolsavel pelo cliente
--   reembolsado_em: timestamptz NULL — quando cliente pagou (NULL = a cobrar)
--
-- Relatorio filtra: reembolsavel = true AND reembolsado_em IS NULL.
-- Depois de pago (reembolsado_em preenchido), a despesa fica com status
-- verde na lista e nao entra em relatorios futuros.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE despesas_empresa
  ADD COLUMN IF NOT EXISTS reembolsavel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reembolsado_em TIMESTAMPTZ;

-- Indice parcial pra query rapida do relatorio: so as pendentes de cobranca
CREATE INDEX IF NOT EXISTS despesas_empresa_reemb_pendente_idx
  ON despesas_empresa (empresa_id, corrida_id)
  WHERE reembolsavel = TRUE AND reembolsado_em IS NULL;

NOTIFY pgrst, 'reload schema';
