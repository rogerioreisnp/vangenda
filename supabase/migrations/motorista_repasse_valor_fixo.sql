-- Migration: modo de repasse do motorista aceita valor fixo alem de percentual.
--
-- Contexto: alguns motoristas parceiros do transfer nao trabalham por
-- percentual do valor da corrida — trabalham por VALOR COMBINADO fixo
-- por servico (ex: motorista recebe sempre R$120 por transfer, nao
-- importa se cliente pagou R$150 ou R$200). Pedido de um cliente do
-- Rogerio (2026-07-28).
--
-- Adiciona 2 colunas em motoristas_empresa:
--   modo_repasse: 'percentual' | 'valor_fixo' (nullable — default null pra
--                 motorista funcionario que nao tem repasse)
--   valor_fixo_repasse: NUMERIC(10,2) — valor por corrida quando modo=fixo
--
-- Retrocompatibilidade: motoristas ja cadastrados com percentual_repasse
-- continuam funcionando exatamente igual. A UI infere modo='percentual'
-- quando modo_repasse e null e percentual_repasse > 0.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE motoristas_empresa
  ADD COLUMN IF NOT EXISTS modo_repasse TEXT
    CHECK (modo_repasse IS NULL OR modo_repasse IN ('percentual', 'valor_fixo')),
  ADD COLUMN IF NOT EXISTS valor_fixo_repasse NUMERIC(10, 2)
    CHECK (valor_fixo_repasse IS NULL OR valor_fixo_repasse >= 0);

-- Backfill: motoristas ja com percentual_repasse preenchido ficam como 'percentual'.
UPDATE motoristas_empresa
SET modo_repasse = 'percentual'
WHERE modo_repasse IS NULL AND percentual_repasse IS NOT NULL;

NOTIFY pgrst, 'reload schema';
