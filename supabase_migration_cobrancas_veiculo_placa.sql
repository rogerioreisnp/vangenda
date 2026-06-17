-- Migration: adiciona coluna veiculo_placa à tabela cobrancas_empresa
-- Execute no Supabase SQL Editor antes de usar o campo Veículo no financeiro rota_fixa
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS veiculo_placa TEXT;
