-- Migration: (1) corrige bug de despesa que não salvava e (2) adiciona
-- detalhamento de cartão nas despesas dos 3 modelos.
--
-- BUG (motorista individual): a tabela `despesas` foi criada com um CHECK
-- constraint em `categoria` que só aceitava
--   ('combustivel','manutencao','pedagio','pneu','outros')
-- Mas o app oferece também alimentacao, estacionamento, hospedagem e
-- financiamento. Ao escolher "Alimentação" o INSERT era rejeitado pelo
-- banco e a despesa não salvava. Removemos o CHECK — o front controla as
-- opções válidas, e categorias novas não vão mais quebrar o banco.
--
-- MELHORIA (Julimar, 2026-07-17): quando a despesa é paga no cartão, o
-- gestor quer registrar QUAL cartão (banco/apelido) e os últimos 4 dígitos
-- pra bater com o extrato. NÃO guardamos o número completo — é dado
-- sensível (LGPD/PCI-DSS). Só banco + final de 4 dígitos, padrão seguro
-- que bancos usam.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

-- ── 1. Remove o CHECK restritivo de categoria em `despesas` ──────────────────
ALTER TABLE despesas DROP CONSTRAINT IF EXISTS despesas_categoria_check;

-- ── 2. Garante forma_pagamento nas 3 tabelas (caso a migration
--       forma_pagamento_despesa.sql não tenha sido executada) ────────────────
ALTER TABLE despesas          ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE despesas_empresa  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- ── 3. Detalhamento do cartão nas 3 tabelas ──────────────────────────────────
-- cartao_banco: nome/apelido do cartão (ex: "Nubank", "Itaú empresarial")
-- cartao_final: últimos 4 dígitos (ex: "1234") — NUNCA o número completo
ALTER TABLE despesas          ADD COLUMN IF NOT EXISTS cartao_banco TEXT;
ALTER TABLE despesas          ADD COLUMN IF NOT EXISTS cartao_final TEXT;
ALTER TABLE despesas_empresa  ADD COLUMN IF NOT EXISTS cartao_banco TEXT;
ALTER TABLE despesas_empresa  ADD COLUMN IF NOT EXISTS cartao_final TEXT;
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS cartao_banco TEXT;
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS cartao_final TEXT;

NOTIFY pgrst, 'reload schema';
