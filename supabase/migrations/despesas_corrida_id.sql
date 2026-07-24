-- Migration: vincula despesa a corrida (transfer).
--
-- Pedido do Julimar: quer ver quanto uma corrida especifica custou
-- (combustivel + pedagio + etc). Precisa poder linkar despesa >> corrida
-- na hora de lancar. Padrao SAP/Bling.
--
-- Nullable + ON DELETE SET NULL: apagar corrida nao apaga a despesa,
-- so desvincula. Historico financeiro preservado.
--
-- Escopo: apenas transfer (despesas_empresa). Rota_fixa (cobrancas_empresa)
-- e individual (despesas) nao foram pedidos.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE despesas_empresa
  ADD COLUMN IF NOT EXISTS corrida_id uuid REFERENCES corridas_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS despesas_empresa_corrida_idx ON despesas_empresa (corrida_id) WHERE corrida_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
