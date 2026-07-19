-- Migration: tabela `pagamentos_orfaos`.
--
-- Contexto: quando a Kiwify chama nosso webhook com um email que nao existe
-- em auth.users (cliente pagou com email diferente do que usou no cadastro do
-- app), hoje o webhook retorna 200 silenciosamente e ninguem sabe. Cliente
-- pagou, dinheiro entrou, mas continua bloqueado no app ate reclamar por
-- WhatsApp. Foi exatamente o caso Girassol tour em 2026-07-19.
--
-- Esta tabela guarda esses pagamentos "orfaos" pra:
--   1. Nao perder nenhum pagamento no ar.
--   2. Permitir resolver depois em 1 SQL (linkar ao user_id correto).
--   3. Servir de base pra auditoria (quantos orfaos por mes = medida de
--      confusao do cliente ou problema no fluxo).
--
-- payload_completo guarda o JSON inteiro que a Kiwify mandou — util pra
-- debugar casos raros sem depender de log do Vercel (que expira).
--
-- Nao tem RLS: acesso apenas via service_role (webhook e admin). Nunca
-- exposto ao usuario final.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

CREATE TABLE IF NOT EXISTS pagamentos_orfaos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_pagamento   TEXT NOT NULL,
  valor             NUMERIC(10, 2),
  plano_nome        TEXT,
  periodo           TEXT,
  expira_em         TIMESTAMPTZ,
  kiwify_order_id   TEXT,
  payload_completo  JSONB,
  resolvido         BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_em      TIMESTAMPTZ,
  resolvido_por     TEXT,
  observacao        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pagamentos_orfaos_email_idx     ON pagamentos_orfaos (email_pagamento);
CREATE INDEX IF NOT EXISTS pagamentos_orfaos_resolvido_idx ON pagamentos_orfaos (resolvido) WHERE NOT resolvido;

NOTIFY pgrst, 'reload schema';
