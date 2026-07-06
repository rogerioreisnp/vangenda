-- Migration: endereço detalhado de EMBARQUE + DESEMBARQUE
-- Pedido do cliente Luan (trial) — endereço detalhado de desembarque no
-- link público e ficha do gestor. Nada obrigatório: colunas nullable.
-- Idempotente. Rode no SQL Editor do Vangenda.

-- ── agendamentos (rota fixa individual) — já tem embarque, falta desembarque ──
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS rua_desembarque TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS numero_desembarque TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS bairro_desembarque TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS municipio_desembarque TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cep_desembarque TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS referencia_desembarque TEXT;

-- ── corridas_empresa (transfer + rota fixa empresarial) — nada existia ──
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS referencia TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS rua_desembarque TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS numero_desembarque TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS bairro_desembarque TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS municipio_desembarque TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS cep_desembarque TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS referencia_desembarque TEXT;

-- Recarrega schema no PostgREST pras colunas aparecerem na API imediatamente
NOTIFY pgrst, 'reload schema';
