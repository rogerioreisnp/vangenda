-- Migration: adiciona rastreabilidade "registrado por" nos registros que o
-- motorista funcionário anota em nome do gestor.
-- Idempotente. Rode no SQL Editor do Supabase do VANGENDA (não Smart Car).
--
-- Efeito zero em registros existentes: coluna nova é nullable, registros
-- antigos ficam com NULL (o gestor vê "anotado por —" só nos novos).
--
-- Comportamento:
-- - Motorista individual: registrado_por = próprio user.id (útil se um dia
--   virar empresa).
-- - Motorista funcionário: motorista_id = gestor (já hoje via
--   getMotoristaIdSalvar), registrado_por = user.id do funcionário. O gestor
--   vê "R$ X anotado por João em DD/MM às HH:MM" no painel.
-- - Gestor anota direto: registrado_por = user.id do próprio gestor.

ALTER TABLE receitas     ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE despesas     ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE encomendas   ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE fretamentos  ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reload schema do PostgREST para as colunas aparecerem na API imediatamente
NOTIFY pgrst, 'reload schema';
