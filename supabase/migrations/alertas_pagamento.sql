-- Migration: marcadores de alerta de pagamento (transfer).
--
-- Contexto: dois clientes pediram alertas automaticos pro GESTOR sobre
-- pagamentos:
--   Item 3 — no dia previsto do pagamento, lembrar de dar baixa
--   Item 4 — no dia seguinte, avisar que continua sem receber
--
-- Um cron diario (/api/cron/notificacoes) varre as corridas e dispara push.
-- Sem esses marcadores, o cron re-enviaria o MESMO alerta todo dia,
-- virando spam. Com eles, cada alerta sai uma vez so por corrida.
--
-- Nullable: corridas antigas ficam NULL e sao elegiveis pro primeiro
-- disparo (comportamento correto — se esta vencida ha tempo, o gestor
-- deve ser avisado uma vez).
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS alerta_pagamento_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alerta_atraso_enviado_em    TIMESTAMPTZ;

-- Indices parciais: o cron so busca corridas nao-recebidas com data
-- prevista preenchida. Sem indice, varreria a tabela toda todo dia.
CREATE INDEX IF NOT EXISTS corridas_alerta_pagamento_idx
  ON corridas_empresa (empresa_id, data_prevista_pagamento)
  WHERE status_pagamento IS DISTINCT FROM 'recebido'
    AND data_prevista_pagamento IS NOT NULL;

NOTIFY pgrst, 'reload schema';
