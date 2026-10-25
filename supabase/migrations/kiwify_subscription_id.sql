-- Migration: guarda o id da assinatura Kiwify que ativou o acesso.
--
-- Contexto: Julimar (Alternativa Move), 2026-10-22. Trocou o plano mensal
-- pelo anual: pagou o anual, a conta ativou, e logo depois chegou o aviso de
-- cancelamento do mensal ANTIGO — o webhook desativou a conta inteira.
--
-- Com o id salvo, o webhook so desativa quando o cancelamento/reembolso e da
-- MESMA assinatura que esta ativa. Aviso de assinatura antiga e ignorado.
--
-- O webhook funciona com ou sem esta migration (sem ela, usa so a comparacao
-- de datas no cancelamento). Rodar quando puder.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas   ADD COLUMN IF NOT EXISTS kiwify_subscription_id TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS kiwify_subscription_id TEXT;

NOTIFY pgrst, 'reload schema';
