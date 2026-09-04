-- Migration: campo "Complemento" nos endereços (transfer).
--
-- Pedido do cliente 2026-09-04: endereço de embarque/desembarque (ida e
-- volta) e o cadastro de clientes não tinham campo pra apartamento, bloco,
-- fundos, ponto de referência interno etc — só rua/número/bairro/cidade/
-- CEP/referência. Sem isso o motorista às vezes chega no endereço certo
-- mas não acha a entrada certa (ex: "Bloco B, apto 302").
--
-- 4 colunas em corridas_empresa (embarque e desembarque da ida e da volta,
-- espelhando os grupos de endereço que já existem) + 1 em clientes_empresa
-- (endereço de cadastro). Todas NULLABLE — retrocompatível, atendimento e
-- cliente sem complemento continuam funcionando normal.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS complemento                    TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS complemento_desembarque        TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS complemento_retorno_embarque   TEXT;
ALTER TABLE corridas_empresa ADD COLUMN IF NOT EXISTS complemento_retorno_desembarque TEXT;

ALTER TABLE clientes_empresa ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;

NOTIFY pgrst, 'reload schema';
