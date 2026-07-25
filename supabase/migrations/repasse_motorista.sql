-- Migration: repasse ao motorista parceiro (Fase 4 vouchers/recibos).
--
-- Contexto: Julimar tem motoristas AGREGADOS (nao funcionarios) que rodam
-- atendimentos e recebem uma parte do valor. Ex: cliente paga R$ 500,
-- motorista Alberto recebe R$ 350 (70%), lucro real do Julimar = R$ 150.
--
-- Duas colunas:
--   1. motoristas_empresa.percentual_repasse — percentual PADRAO do motorista
--      (ex: 70%). Autopreenche o campo no form quando o gestor atribui esse
--      motorista. Nullable — motorista funcionario nao tem repasse.
--   2. corridas_empresa.valor_repasse_motorista — valor final do repasse
--      naquele atendimento (pode ser calculado do percentual, ou digitado
--      manual pelo gestor pra ajustes eventuais). Nullable — atendimentos
--      antigos ou sem motorista externo ficam null.
--
-- Lucro real do gestor = valor - valor_repasse_motorista (calculado no client,
-- nao guardado — evita inconsistencia se um dos dois campos mudar).
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE motoristas_empresa
  ADD COLUMN IF NOT EXISTS percentual_repasse NUMERIC(5, 2)
    CHECK (percentual_repasse IS NULL OR (percentual_repasse >= 0 AND percentual_repasse <= 100));

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS valor_repasse_motorista NUMERIC(10, 2)
    CHECK (valor_repasse_motorista IS NULL OR valor_repasse_motorista >= 0);

NOTIFY pgrst, 'reload schema';
