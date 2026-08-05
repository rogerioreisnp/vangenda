-- Observacao + anexo do MOTORISTA (transfer) — separado da "observacoes"
-- que o gestor escreve ao criar o atendimento. Pedido do Julimar,
-- 2026-08-05: motorista quer poder avisar o gestor de algo (ex: pagou
-- estacionamento, precisa de reembolso) e anexar a nota/comprovante.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS observacao_motorista TEXT,
  ADD COLUMN IF NOT EXISTS anexo_motorista_url TEXT;

-- Bucket pro upload do anexo (foto ou PDF) — mesmo padrao do
-- bucket_logos_empresas.sql: publico pra leitura (link direto sem precisar
-- de signed URL), escrita so autenticado.
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos-motorista', 'anexos-motorista', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anexos-motorista leitura publica" ON storage.objects;
CREATE POLICY "anexos-motorista leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'anexos-motorista');

DROP POLICY IF EXISTS "anexos-motorista upload autenticado" ON storage.objects;
CREATE POLICY "anexos-motorista upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos-motorista');

DROP POLICY IF EXISTS "anexos-motorista update autenticado" ON storage.objects;
CREATE POLICY "anexos-motorista update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'anexos-motorista');

DROP POLICY IF EXISTS "anexos-motorista delete autenticado" ON storage.objects;
CREATE POLICY "anexos-motorista delete autenticado"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anexos-motorista');

NOTIFY pgrst, 'reload schema';
