-- ============================================================
-- Migration: Sistema de Transfer Completo
-- Execute no Supabase > SQL Editor
-- ============================================================

-- 1.1 Cor do veículo em motoristas_empresa
ALTER TABLE motoristas_empresa
ADD COLUMN IF NOT EXISTS cor text;

-- 1.2 Novas colunas em solicitacoes_transfer
ALTER TABLE solicitacoes_transfer
ADD COLUMN IF NOT EXISTS numero_reserva serial,
ADD COLUMN IF NOT EXISTS origem_passageiro2 text,
ADD COLUMN IF NOT EXISTS destino_passageiro2 text,
ADD COLUMN IF NOT EXISTS motorista_id uuid references motoristas_empresa(id),
ADD COLUMN IF NOT EXISTS valor numeric(10,2);

-- 1.3 Tabela de endereços para autocomplete
CREATE TABLE IF NOT EXISTS enderecos_clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id),
  telefone text not null,
  endereco text not null,
  contador integer default 1,
  created_at timestamp with time zone default now()
);

ALTER TABLE enderecos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa vê apenas seus endereços"
ON enderecos_clientes
FOR ALL
USING (empresa_id = (
  select empresa_id from gestores where id = auth.uid()
));

-- ============================================================
-- Políticas RLS para acesso anon (formulário público)
-- Necessário para o formulário de agendamento funcionar
-- ============================================================

-- Permite que o formulário público insira solicitações de transfer
CREATE POLICY "anon_insert_solicitacoes_transfer"
ON solicitacoes_transfer
FOR INSERT TO anon
WITH CHECK (true);

-- Permite que o formulário público insira corridas diretamente
CREATE POLICY "anon_insert_corridas_empresa"
ON corridas_empresa
FOR INSERT TO anon
WITH CHECK (true);

-- Permite que o formulário público leia endereços (autocomplete)
CREATE POLICY "anon_select_enderecos_clientes"
ON enderecos_clientes
FOR SELECT TO anon
USING (true);

-- Permite que o formulário público insira novos endereços
CREATE POLICY "anon_insert_enderecos_clientes"
ON enderecos_clientes
FOR INSERT TO anon
WITH CHECK (true);

-- Permite que o formulário público incremente o contador de endereços
CREATE POLICY "anon_update_enderecos_clientes"
ON enderecos_clientes
FOR UPDATE TO anon
USING (true);
