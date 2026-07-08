-- Migration: permite lançamento manual de RECEITA no financeiro Transfer
-- Rogério notou que no financeiro do transfer só existe "+ Adicionar despesa"
-- — receita só entra automático pelas corridas. Pedido: poder lançar receita
-- manual também (ex: corrida combinada por fora do app, gorjeta, venda extra).
--
-- Reaproveita a tabela despesas_empresa (mesmo padrão já usado no financeiro
-- de rota fixa, onde cobrancas_empresa tem coluna 'tipo'). Registros antigos
-- continuam como 'despesa' (default). Idempotente.

ALTER TABLE despesas_empresa ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'despesa';

NOTIFY pgrst, 'reload schema';
