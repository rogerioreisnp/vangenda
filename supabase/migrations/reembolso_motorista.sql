-- Reembolso ao MOTORISTA quando ele paga a despesa do proprio bolso.
--
-- Julimar 2026-11-24: "o motorista pagou estacionamento; o cliente reembolsa
-- pelo voucher, e o valor tem que ir pro repasse do motorista tambem (porque
-- foi ele que desembolsou)". O fluxo de reembolso que existe hoje
-- (`despesas_empresa.reembolsavel` + `reembolsado_em`) so cobre a ponta
-- cliente -> empresa. A ponta empresa -> motorista nao existia.
--
--   pago_por                  TEXT   : 'empresa' (default) ou 'motorista'
--   motorista_reembolsado_em  TIMESTAMPTZ : NULL ate o Julimar dar baixa
--                             no repasse incluindo esta despesa
--
-- Fluxo:
--   1. Julimar cadastra despesa reembolsavel, marca "pago por motorista"
--   2. Voucher continua mostrando a despesa na secao Reembolsos (cliente paga)
--   3. Modal "Marcar repasse como pago" soma o valor dessas despesas ao
--      valor_repasse_motorista e marca motorista_reembolsado_em ao confirmar
--   4. Despesa ja reembolsada ao motorista nao volta no proximo repasse
--
-- Idempotente. Execute no SQL Editor do Vangenda ANTES de publicar: a tela
-- de fretamentos passa a pedir as colunas na query do modal de repasse.

ALTER TABLE despesas_empresa
  ADD COLUMN IF NOT EXISTS pago_por TEXT NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS motorista_reembolsado_em TIMESTAMPTZ;

-- Constraint fraco de dominio — nao usamos enum pra manter migracao reversivel.
ALTER TABLE despesas_empresa
  DROP CONSTRAINT IF EXISTS despesas_empresa_pago_por_check;
ALTER TABLE despesas_empresa
  ADD CONSTRAINT despesas_empresa_pago_por_check
  CHECK (pago_por IN ('empresa', 'motorista'));

-- Indice parcial: query do modal de baixa do repasse busca so os pendentes
-- de UMA corrida, entao esse filtro pega o caso quente.
CREATE INDEX IF NOT EXISTS despesas_empresa_reemb_motorista_pendente_idx
  ON despesas_empresa (corrida_id)
  WHERE pago_por = 'motorista' AND motorista_reembolsado_em IS NULL AND corrida_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
