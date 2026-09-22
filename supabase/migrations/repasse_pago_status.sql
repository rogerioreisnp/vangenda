-- Migration: controle de pagamento do REPASSE ao motorista parceiro.
--
-- Contexto (Julimar 2026-09-21): o sistema ja tinha valor do repasse por
-- atendimento (valor_repasse_motorista) e ate emitia recibo de repasse em
-- PDF — mas nao dava pra saber se aquele repasse JA foi pago ou nao. O
-- gestor decorava ou anotava por fora. Nao escala com muitos motoristas.
--
-- Espelha o padrao ja usado pra pagamento do CLIENTE (status_pagamento /
-- data_pagamento), agora do lado do gestor -> motorista:
--   - repasse_status: 'a_pagar' (default) | 'pago'
--   - repasse_data_pago: quando o gestor efetivou o pagamento
--   - repasse_forma_pagamento: pix / dinheiro / transferencia / etc
--
-- So faz sentido em atendimento com valor_repasse_motorista > 0. Se o
-- motorista e funcionario (sem repasse), esses campos ficam null/'a_pagar'
-- e nunca aparecem na tela (o selo/botao so sao renderizados quando ha
-- valor de repasse).
--
-- Retrocompativel — coluna novas nullable, atendimentos antigos ficam como
-- 'a_pagar' (que e a verdade: se nao havia como marcar, ainda nao foram
-- marcados). O gestor pode dar baixa retroativa em massa pela Fase 4.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS repasse_status TEXT NOT NULL DEFAULT 'a_pagar'
    CHECK (repasse_status IN ('a_pagar', 'pago'));

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS repasse_data_pago DATE;

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS repasse_forma_pagamento TEXT;

-- Indice parcial: consulta "quanto devo pros motoristas" so olha as linhas
-- que tem repasse E ainda estao pendentes — nao vale indexar o mundo todo.
CREATE INDEX IF NOT EXISTS corridas_empresa_repasse_pendente_idx
  ON corridas_empresa (motorista_id)
  WHERE valor_repasse_motorista IS NOT NULL
    AND valor_repasse_motorista > 0
    AND repasse_status = 'a_pagar';

NOTIFY pgrst, 'reload schema';
