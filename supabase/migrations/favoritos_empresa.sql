-- Migration: favoritos de clientes, motoristas e rotas (transfer empresarial).
--
-- Pedido Julimar 2026-11-19: alem de ordem alfabetica, poder "fixar" os que
-- mais usa pra aparecerem no topo das listas e dos dropdowns (padrao dos
-- apps profissionais: favoritos no topo, depois o resto em ordem alfabetica).
--
-- Favorito e da EMPRESA (coluna booleana na propria tabela), nao por usuario —
-- simples e suficiente pra quem opera sozinho (decisao Rogerio 2026-11-19).
-- Default false: tudo comeca sem favorito, nada muda pra quem nao usar.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE clientes_empresa   ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE motoristas_empresa ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rotas_empresa      ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
