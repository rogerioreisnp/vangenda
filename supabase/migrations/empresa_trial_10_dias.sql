-- Migration: trial empresarial passa de 15 -> 10 dias.
--
-- Motivacao: padronizar com o trial individual (que ja e 10 dias) e reduzir o
-- ciclo de decisao do cliente. Todos os textos no app ja foram atualizados
-- pra "10 dias" no mesmo commit.
--
-- Escopo: apenas o DEFAULT da coluna trial_fim em `empresas`. Empresas ja
-- cadastradas mantem o prazo antigo (15 dias) -- nao retroagimos prazo com
-- cliente ja em trial, seria quebra de expectativa.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas
  ALTER COLUMN trial_fim SET DEFAULT (NOW() + INTERVAL '10 days');

NOTIFY pgrst, 'reload schema';
