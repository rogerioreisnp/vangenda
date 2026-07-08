-- Migration: forma de pagamento nas despesas (Pix/Cartão/Dinheiro)
-- Julio pediu: registrar como cada despesa foi paga, pra ele saber se
-- saiu do Pix, cartão ou dinheiro (ele guarda reserva pra manutenção
-- numa caixinha do Nubank e quer bater com o extrato). Nos 3 modelos
-- pra manter consistência. Nullable/idempotente.

ALTER TABLE despesas_empresa ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;   -- transfer
ALTER TABLE cobrancas_empresa ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;  -- rota fixa (empresa) — já existe pra receita, garante despesa tbm
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;          -- motorista individual

NOTIFY pgrst, 'reload schema';
