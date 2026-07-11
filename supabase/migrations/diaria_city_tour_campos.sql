-- Migration: campos específicos para diária e city tour em corridas_empresa.
--
-- Julimar (cliente Vangenda transfer) mapeou o fluxo de diária/city tour:
--   - Data e hora de INÍCIO (data_hora já existe pra isso)
--   - Data e hora de TÉRMINO (nova coluna, opcional e editável)
--   - Local de início (origem já existe)
--   - Trajetos percorridos (nova coluna JSONB — array de strings)
--     Pode ser vazio no cadastro; gestor adiciona durante o serviço para
--     casos em que o passageiro só vai dizendo os locais no momento.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS data_hora_termino TIMESTAMPTZ;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS trajetos          JSONB;

NOTIFY pgrst, 'reload schema';
