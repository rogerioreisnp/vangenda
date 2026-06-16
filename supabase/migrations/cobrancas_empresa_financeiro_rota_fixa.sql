-- Migration: adiciona colunas financeiras à cobrancas_empresa para empresas rota_fixa
-- Execute no SQL Editor do Supabase antes de usar o Financeiro rota_fixa

ALTER TABLE cobrancas_empresa
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS data DATE,
  ADD COLUMN IF NOT EXISTS observacao TEXT;
