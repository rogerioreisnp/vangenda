-- Migration: adiciona motorista_id e veiculo_placa à tabela rotas_empresa
-- Necessário para empresas com tipo_operacao = 'rota_fixa'
-- Executar no Supabase SQL Editor

ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES motoristas_empresa(id) ON DELETE SET NULL;
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS veiculo_placa text;
