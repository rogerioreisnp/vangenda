-- Adiciona campos de data e horário de entrega às encomendas
ALTER TABLE encomendas
  ADD COLUMN IF NOT EXISTS data_entrega DATE,
  ADD COLUMN IF NOT EXISTS horario_entrega TIME;
