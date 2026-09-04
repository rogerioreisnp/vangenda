-- Migration: CNH no cadastro do motorista + alerta de vencimento.
--
-- Pedido do cliente 2026-09-04: número e validade da CNH no cadastro do
-- motorista (transfer), com alerta quando estiver vencendo — hoje o
-- sistema não guarda isso em lugar nenhum.
--
-- cnh_alerta_enviado_em controla o disparo: o cron
-- (/api/cron/notificacoes) avisa o gestor UMA vez quando a CNH está a
-- ≤30 dias do vencimento (ou já vencida) e ainda não foi alertada. Quando
-- o gestor atualiza a validade pra uma data nova (renovação), a tela
-- zera esse campo de novo, permitindo alertar no próximo vencimento.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE motoristas_empresa ADD COLUMN IF NOT EXISTS cnh_numero TEXT;
ALTER TABLE motoristas_empresa ADD COLUMN IF NOT EXISTS cnh_vencimento DATE;
ALTER TABLE motoristas_empresa ADD COLUMN IF NOT EXISTS cnh_alerta_enviado_em TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
