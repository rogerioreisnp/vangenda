-- Migration: adiciona coluna quilometragem à tabela cobrancas_empresa
-- Execute no Supabase SQL Editor antes de usar o financeiro rota_fixa
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS quilometragem INTEGER;
