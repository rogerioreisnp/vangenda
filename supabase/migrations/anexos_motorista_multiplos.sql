-- Varios anexos do motorista por atendimento.
--
-- Julimar 2026-11-23: motorista paga 2 estacionamentos no mesmo dia e o
-- upload do segundo sobrescrevia o primeiro, porque `anexo_motorista_url`
-- e uma coluna TEXT unica (ver observacao_anexo_motorista.sql).
--
--   anexos_motorista_urls  JSONB: ["https://.../1.jpg", "https://.../2.pdf"]
--
-- Coluna nova; a antiga continua. A tela une as duas na leitura e, na
-- primeira gravacao da coluna nova, migra o valor da antiga pro array e
-- zera a antiga. Nenhum anexo existente e perdido.
--
-- NULL por padrao; o codigo e tolerante: pode publicar antes do SQL rodar
-- (o motorista continua trocando um anexo, igual hoje). Depois do SQL,
-- passa a acumular.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS anexos_motorista_urls JSONB;

NOTIFY pgrst, 'reload schema';
