-- Anexo do campo Observacoes (transfer) — separado do anexo do motorista
-- (observacao_anexo_motorista.sql). Pedido do Julimar, 2026-08-05: ao
-- criar o atendimento, ele escreve na Observacao algo tipo "usar a placa
-- anexo para fazer o receptivo no aeroporto" e quer anexar o PDF da
-- plaquinha ali mesmo, antes de confirmar.
--
-- Reaproveita o bucket 'anexos-motorista' ja criado (qualquer autenticado
-- pode subir/ler) — nao precisa de bucket novo.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS anexo_observacoes_url TEXT;

NOTIFY pgrst, 'reload schema';
