-- Migration: campo `preencher_passageiro_automatico` em `empresas`.
--
-- Contexto: a correcao de sigilo (2026-08-12) parou de copiar o nome do
-- solicitante pro passageiro quando o gestor nao preenche o passageiro na
-- hora de criar o atendimento — certo pro Julimar (AAJP), que recebe so o
-- nome do solicitante de agencias de turismo e o passageiro de verdade e
-- outra pessoa, as vezes sigilosa.
--
-- Mas o Alexandre (ASF Transporte, Curitiba) tem o oposto: pra ele, 90%+
-- das vezes o solicitante JA E o passageiro, e ele nao quer digitar o
-- mesmo nome duas vezes. Sem esse campo, toda corrida dele nasce como
-- "Passageiro a confirmar" e o motorista reclama.
--
-- Este campo liga/desliga esse comportamento POR EMPRESA. Default FALSE
-- (comportamento atual, seguro por padrao) — cada gestor ativa em
-- Configuracoes se o perfil de cliente dele for como o do Alexandre.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS preencher_passageiro_automatico BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
