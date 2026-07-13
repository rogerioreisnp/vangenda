-- Migration: quilometragem inicial e final por corrida (Julimar).
--
-- Caso: motorista preenche KM inicial ao começar o serviço e KM final ao
-- terminar. Sistema calcula automaticamente o total percorrido (diferença).
-- Vale pra transfer normal, diária e city tour — modalidades onde o
-- motorista roda por uma corrida individual.
--
-- Fretamento e excursão têm outro fluxo (via tabela cobrancas_empresa
-- que já tem coluna quilometragem separada). Rota_fixa é linha de van
-- fixa por dia. Individual não é empresarial.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS km_inicial NUMERIC(10, 1);
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS km_final   NUMERIC(10, 1);

NOTIFY pgrst, 'reload schema';
