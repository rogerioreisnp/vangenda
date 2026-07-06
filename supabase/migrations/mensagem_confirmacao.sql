-- Migration: mensagem de confirmação editável (WhatsApp)
-- Pedido do Rogério: deixar o motorista/empresa personalizar a mensagem
-- que é enviada ao passageiro/cliente ao confirmar o agendamento, em vez
-- de ficar fixa no código. Se ficar vazia, o app usa o texto padrão atual
-- (nada muda pra quem não mexer). Nullable/idempotente.

-- Rota fixa individual (motorista solo, tela /dashboard/agenda)
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS mensagem_confirmacao TEXT;

-- Empresa: rota fixa via /dashboard/agenda (mesma estrutura de mensagem
-- do motorista individual) + fretamentos/transfer via corridas_empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS mensagem_confirmacao TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS mensagem_confirmacao_transfer TEXT;

NOTIFY pgrst, 'reload schema';
