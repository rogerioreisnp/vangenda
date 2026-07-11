-- Migration: modo endereço livre para rota_fixa (caso Luan).
--
-- Contexto: Luan (cliente Vangenda rota_fixa) opera diferente dos demais.
-- Não tem paradas fixas — leva 4 clientes de município A pra município B,
-- cada um pego e deixado em endereços diferentes. Hoje rota_fixa força
-- select de paradas pré-cadastradas, o que não atende. Ele foi passado
-- pra transfer temporariamente, mas transfer não tem encomendas nem
-- Google Maps que ele precisa.
--
-- Solução: nova coluna `modo_endereco` em rotas_empresa. Cada rota da
-- empresa pode ser:
--   - 'paradas' (default, comportamento atual): cliente escolhe embarque
--     e desembarque de listas pré-cadastradas em paradas_empresa
--   - 'livre': cliente digita endereço estruturado (rua, número, bairro,
--     município, CEP, referência), mesmo padrão do transfer. Preço vem
--     da rota inteira (rotas_empresa.preco), sem trecho.
--
-- Idempotente. Rotas existentes ficam com 'paradas' (comportamento
-- preservado). Execute no SQL Editor do Supabase do Vangenda.

ALTER TABLE rotas_empresa
  ADD COLUMN IF NOT EXISTS modo_endereco TEXT NOT NULL DEFAULT 'paradas';

-- Adiciona o CHECK constraint separadamente (idempotente):
-- se já existir com esse nome, o DO $$ ... $$ ignora.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rotas_empresa_modo_endereco_check'
  ) THEN
    ALTER TABLE rotas_empresa
      ADD CONSTRAINT rotas_empresa_modo_endereco_check
      CHECK (modo_endereco IN ('paradas', 'livre'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
