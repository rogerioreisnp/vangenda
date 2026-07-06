-- Migration: quantidade de bagagem por agendamento
-- Pedido do cliente Luan (trial) — motorista quer saber quantas malas/
-- volumes de bagagem o passageiro vai levar, pra organizar espaço na van.
-- Nullable/default 0. Idempotente. Rode no SQL Editor do Vangenda.

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS quantidade_bagagem INT DEFAULT 0;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS quantidade_bagagem INT DEFAULT 0;

NOTIFY pgrst, 'reload schema';
