-- =====================================================
-- MIGRAÇÃO: Campos de endereço e capacidade
-- Execute no Supabase: SQL Editor → New Query
-- =====================================================

-- Capacidade da van na tabela rotas (caso não exista)
alter table rotas add column if not exists capacidade integer default 15;

-- Campos de endereço de embarque nos agendamentos
alter table agendamentos add column if not exists rua text;
alter table agendamentos add column if not exists municipio text;
alter table agendamentos add column if not exists cep text;
