-- Migration: excedentes do atendimento (transfer / diaria / city tour).
--
-- Pedido Julimar 2026-11-19:
--   - Diaria e contratada com franquia de horas e de km; o que passar e
--     cobrado como hora extra e km excedente.
--   - Transfer tem tolerancia de espera; passou dela, cobra hora parada.
--   - Valores e franquias mudam a cada contratacao; o motorista informa o
--     tempo pelo app e recebe repasse sobre os excedentes.
--
--   excedentes         JSONB: { condicoes: {...}, aplicado: {...} }
--                      condicoes = franquias, tolerancia, valores e % do motorista
--                      aplicado  = o que o gestor ja lancou no valor/repasse
--   minutos_parada     tempo total de espera informado pelo motorista
--   minutos_hora_extra horas extras (alem da franquia) informadas pelo motorista
--
-- Tudo NULL por padrao: atendimento sem excedente segue exatamente igual.
--
-- Execute no SQL Editor do Vangenda ANTES de publicar o codigo: a tela de
-- atendimentos le essas colunas ao carregar.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS excedentes JSONB;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS minutos_parada INTEGER;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS minutos_hora_extra INTEGER;

NOTIFY pgrst, 'reload schema';
