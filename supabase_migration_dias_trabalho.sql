-- Migration: adiciona dias_trabalho ao motorista
-- Executar no Supabase SQL Editor

ALTER TABLE motoristas
ADD COLUMN IF NOT EXISTS dias_trabalho integer[];

COMMENT ON COLUMN motoristas.dias_trabalho IS 'Dias da semana que o motorista trabalha. 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab';
