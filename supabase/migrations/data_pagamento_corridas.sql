-- Migration: fluxo de recebimento do faturado (transfer empresa)
-- Julio/Julimar pediram: corrida faturada só vira Receita quando o gestor
-- marcar como efetivamente recebida (status_pagamento = 'recebido'), na data
-- em que o dinheiro realmente caiu (data_pagamento) — não na data da viagem.
-- "A receber" passa a ser toda corrida CONCLUÍDA que ainda não foi marcada
-- como recebida (sem travar em mês). Também guardamos uma data prevista de
-- recebimento (informativa) pra faturado.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS data_prevista_pagamento DATE;

-- O link público (cliente agendando direto) nunca preencheu status_pagamento,
-- então essas corridas ficam NULL nessa coluna. As novas contas do financeiro
-- filtram por status_pagamento = 'recebido' / != 'recebido' — e em SQL, NULL
-- não bate em nenhum dos dois lados, o que faria essas corridas desaparecerem
-- do financeiro. Por isso: default 'a_receber' pra toda corrida nova, e
-- backfill de quem já está NULL hoje.
ALTER TABLE corridas_empresa ALTER COLUMN status_pagamento SET DEFAULT 'a_receber';
UPDATE corridas_empresa SET status_pagamento = 'a_receber' WHERE status_pagamento IS NULL;

-- Backfill: corridas já concluídas pagas na hora (pix/dinheiro/cartão) que
-- ainda não foram marcadas como "recebido" — sem isso, o "A receber" ficaria
-- inflado retroativamente com corridas que já foram pagas há tempos.
UPDATE corridas_empresa
SET status_pagamento = 'recebido',
    data_pagamento = data_hora::date,
    valor_recebido = valor
WHERE status = 'concluida'
  AND forma_pagamento IN ('pix', 'dinheiro', 'cartao')
  AND status_pagamento != 'recebido';

NOTIFY pgrst, 'reload schema';
