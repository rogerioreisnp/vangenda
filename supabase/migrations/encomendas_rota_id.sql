-- Migration: encomendas podem ser vinculadas a uma rota da empresa.
--
-- Contexto (rota_fixa empresarial): a empresa pode ter várias rotas pra
-- localidades diferentes. Encomendas hoje não têm rota — o gestor/motorista
-- não sabe em qual van a encomenda vai. Coluna nullable: encomendas antigas
-- (e as do motorista individual, que não tem rotas de empresa) continuam
-- funcionando exatamente como antes, aparecendo em "Todas as rotas".
--
-- FK aponta pra rotas_empresa com ON DELETE SET NULL — apagar uma rota não
-- apaga as encomendas, só desvincula.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE encomendas
  ADD COLUMN IF NOT EXISTS rota_id uuid REFERENCES rotas_empresa(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
