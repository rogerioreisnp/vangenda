-- Migration: lembrete configuravel antes do atendimento (transfer).
--
-- Contexto: clientes pediram que o motorista (e o gestor) recebam um aviso
-- X minutos antes do atendimento. O tempo varia por empresa — em cidade
-- grande o motorista precisa sair muito antes; em cidade menor, menos.
-- Decisao (Rogerio, 2026-07-30): configuracao POR EMPRESA, vale pra todos
-- os atendimentos dela.
--
-- Como funciona: ao salvar um atendimento com motorista + horario futuro,
-- o sistema agenda a notificacao no OneSignal usando send_after (entrega
-- programada nativa). Nao precisa de cron rodando de minuto em minuto.
--
-- onesignal_lembrete_id guarda o ID da notificacao agendada. Se o gestor
-- mudar o horario, trocar o motorista ou cancelar o atendimento, usamos
-- esse ID pra CANCELAR o lembrete antigo antes de agendar o novo — senao
-- sobraria push avisando de horario errado.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS minutos_antes_lembrete INTEGER DEFAULT 60
    CHECK (minutos_antes_lembrete IS NULL OR (minutos_antes_lembrete >= 0 AND minutos_antes_lembrete <= 1440));

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS onesignal_lembrete_id TEXT;

NOTIFY pgrst, 'reload schema';
