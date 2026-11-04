-- Migration: mensagem da ficha pro motorista personalizavel por empresa.
--
-- Contexto: Julimar (Alternativa Move, 2026-11-04) pediu pra tirar o rodape
-- com os dados da empresa da mensagem do motorista e incluir orientacoes
-- ("Chegar sempre 15 minutos antes", "Mantenha trabalho de excelencia..."). O
-- sistema atende outras empresas, entao nada disso pode ser fixo: cada gestor
-- monta o seu em Configuracoes, frase por frase.
--
--   msg_motorista_avisos: frases logo abaixo da data e horario
--   msg_motorista_final:  frases no fim da mensagem
--   msg_motorista_rodape: mostra os dados da empresa no rodape da mensagem
--
-- Defaults reproduzem o comportamento atual (sem frases, com rodape): empresa
-- que nao mexer continua recebendo exatamente a mesma mensagem.
--
-- Idempotente. Execute no SQL Editor do Vangenda ANTES de publicar o codigo:
-- a tela de atendimentos le essas colunas ao carregar.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS msg_motorista_avisos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS msg_motorista_final  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS msg_motorista_rodape BOOLEAN NOT NULL DEFAULT TRUE;

NOTIFY pgrst, 'reload schema';
