-- Migration: adiciona colunas veiculo_placa e responsavel à tabela cobrancas_empresa
-- Execute no Supabase SQL Editor antes de usar os campos no financeiro rota_fixa
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS veiculo_placa TEXT;
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS responsavel TEXT;
