-- Migration: separa "Responsável pela solicitação" de "Passageiro 1"
-- Rogério pediu (via cliente Julio): quem solicita o transfer nem sempre é
-- quem viaja (pode ser empresa, secretária, etc). Hoje cliente_nome/telefone
-- serve pros dois papéis ao mesmo tempo. Agora vira:
--   - cliente_nome/cliente_telefone = responsável (contato, já existiam)
--   - passageiro1_nome/passageiro1_telefone = quem realmente viaja (novo)
-- Endereço, número do voo e demais passageiros já tinham colunas próprias
-- (rua, numero, ..., numero_voo, passageiros_adicionais) — sem mudança aí.
-- Nullable. Idempotente.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS passageiro1_nome TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS passageiro1_telefone TEXT;

NOTIFY pgrst, 'reload schema';
