-- Migration: quantidade de passageiros no link empresarial (transfer/rota fixa)
-- Pedido do Rogério: família de 3-4 pessoas quer informar quantos vão no
-- transfer, sem precisar nomear cada um (o "Passageiro adicional" que já
-- existe continua igual, isso é só um contador informativo a mais).
-- Nullable/default 1. Idempotente.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS quantidade_passageiros INT DEFAULT 1;

NOTIFY pgrst, 'reload schema';
