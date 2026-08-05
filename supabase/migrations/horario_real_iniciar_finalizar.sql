-- Horario REAL de inicio/fim do atendimento (transfer) — diferente do
-- data_hora agendado, que e so o horario planejado.
--
-- Contexto (Julimar, 2026-08-05): na ficha do motorista, o KM final aparece
-- sem nenhum horario junto ("tem o horario do inicio mas nao tem o do fim").
-- Investigado: o sistema nunca registrou o horario REAL de quando o
-- motorista apertou Iniciar/Finalizar — so guarda o KM. Nao tinha horario
-- de fim porque nunca teve de inicio tambem, so nao aparecia por nao ter
-- pra onde olhar.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
