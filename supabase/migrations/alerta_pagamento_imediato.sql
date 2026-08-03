-- Alerta pro gestor sobre pagamentos Pix/Dinheiro/Cartao ainda nao
-- recebidos, X horas depois do atendimento.
--
-- Contexto: os alertas de pagamento ja existentes (data_prevista_pagamento)
-- so cobrem "Faturado", que e a unica forma com data de vencimento real.
-- Pix/Dinheiro/Cartao sao esperados no proprio dia do atendimento -- se o
-- motorista nao repassar pro gestor (ou o cliente nao fizer o Pix), hoje
-- ninguem e avisado. Decisao Rogerio 2026-08-01: alertar 1x, X horas apos
-- o atendimento, com X configuravel por empresa (padrao 24h).
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS horas_apos_atendimento_cobranca INTEGER DEFAULT 24
    CHECK (horas_apos_atendimento_cobranca IS NULL OR (horas_apos_atendimento_cobranca >= 0 AND horas_apos_atendimento_cobranca <= 720));

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS alerta_pagamento_imediato_enviado_em TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
