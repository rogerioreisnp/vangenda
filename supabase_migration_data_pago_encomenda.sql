-- Migration: adiciona data_pago às encomendas para rastreio de receita
-- Executar no Supabase SQL Editor

ALTER TABLE encomendas
ADD COLUMN IF NOT EXISTS data_pago date;

COMMENT ON COLUMN encomendas.data_pago IS 'Data em que a encomenda foi quitada. Usada para registrar a receita no dia correto';
