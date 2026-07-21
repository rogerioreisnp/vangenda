-- Migration: adiciona `pix_banco` em despesas_empresa (transfer).
--
-- Pedido do Julimar (Alternativa Move): quando a despesa e paga via Pix, ele
-- quer registrar QUAL banco recebeu (Nubank, Itau, Sicoob etc), pra bater
-- com o extrato bancario no fim do mes.
--
-- Segue o mesmo padrao ja aplicado para `cartao_banco` (migration
-- despesa_categoria_livre_e_cartao.sql). Coluna nullable: registros antigos
-- e formas de pagamento diferentes de Pix ficam null.
--
-- Escopo: apenas `despesas_empresa` (usada pelo transfer). Rota_fixa usa
-- `cobrancas_empresa` — nao aplicado agora, se pedirem no futuro fazemos.
-- Individual usa `despesas` — nao pedido.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE despesas_empresa
  ADD COLUMN IF NOT EXISTS pix_banco TEXT;

NOTIFY pgrst, 'reload schema';
