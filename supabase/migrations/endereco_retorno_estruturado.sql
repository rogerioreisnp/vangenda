-- Migration: endereço estruturado da volta (embarque + desembarque) por
-- passageiro. Antes tínhamos apenas retorno_origem/retorno_destino como
-- texto solto — o link público perdia detalhamento e o cliente não conseguia
-- alterar o endereço da volta quando ele era diferente do desembarque da ida.
--
-- Colunas novas em `corridas_empresa`:
--   rua_retorno_embarque, numero_retorno_embarque, bairro_retorno_embarque,
--   municipio_retorno_embarque, cep_retorno_embarque, referencia_retorno_embarque
--   rua_retorno_desembarque, numero_retorno_desembarque, bairro_retorno_desembarque,
--   municipio_retorno_desembarque, cep_retorno_desembarque, referencia_retorno_desembarque
--
-- Idempotente. Execute no SQL Editor do Supabase do Vangenda.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS rua_retorno_embarque         TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS numero_retorno_embarque      TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS bairro_retorno_embarque      TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS municipio_retorno_embarque   TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS cep_retorno_embarque         TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS referencia_retorno_embarque  TEXT;

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS rua_retorno_desembarque        TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS numero_retorno_desembarque     TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS bairro_retorno_desembarque     TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS municipio_retorno_desembarque  TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS cep_retorno_desembarque        TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS referencia_retorno_desembarque TEXT;

NOTIFY pgrst, 'reload schema';
