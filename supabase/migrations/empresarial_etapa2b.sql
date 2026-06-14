-- Etapa 2B: adiciona campos de tipo de serviço e forma de pagamento às corridas
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS tipo_servico TEXT DEFAULT 'transfer';
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'a_definir';
