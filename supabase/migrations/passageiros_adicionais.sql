-- Migration: múltiplos passageiros adicionais no transfer (link empresarial)
-- Antes só dava pra nomear MAIS 1 passageiro (nome_passageiro2/telefone_passageiro2,
-- que continuam existindo e funcionando como antes). Agora dá pra clicar em
-- "+ Adicionar passageiro" quantas vezes precisar (família de 3, 4, 5...),
-- cada um com nome, telefone e endereço de embarque/desembarque próprios.
-- Guardamos a lista completa em JSON. Nullable/idempotente.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS passageiros_adicionais JSONB;

NOTIFY pgrst, 'reload schema';
