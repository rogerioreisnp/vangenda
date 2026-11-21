-- Migration: lista nominal de passageiros do FRETAMENTO.
--
-- Pedido 2026-11-21 (cliente rota fixa): a lista do fretamento "não abria".
-- O fretamento (igreja, empresa, excursão) é um frete à parte, com os
-- passageiros dele, separado dos passageiros da rota do dia. Exigência
-- ANTT/PRF em viagem intermunicipal: nome completo; RG/CPF opcional.
--
--   lista_passageiros  JSONB: [{ "nome": "...", "documento": "..." }, ...]
--
-- Nos dois apps:
--   fretamentos        -> app individual (agenda)
--   corridas_empresa   -> app empresarial (fretamento/excursão da rota fixa)
--
-- NULL por padrão: nada muda nos registros existentes. O código só lê a
-- coluna quando a tela da lista abre, então é seguro publicar antes.
-- Idempotente: pode rodar mais de uma vez.

ALTER TABLE fretamentos      ADD COLUMN IF NOT EXISTS lista_passageiros JSONB;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS lista_passageiros JSONB;

NOTIFY pgrst, 'reload schema';
