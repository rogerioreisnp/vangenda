-- Varios anexos da observacao do atendimento (gestor).
--
-- Julimar 2026-11-24: "o gestor tambem tem que poder anexar mais de um
-- comprovante" (depois que o motorista ganhou multiplos em 11-23). A
-- coluna `anexo_observacoes_url` guarda UMA url so.
--
--   anexos_observacoes_urls  JSONB: ["https://.../1.pdf", "https://.../2.jpg"]
--
-- Coluna nova; a antiga continua. O form une as duas na edicao (ver
-- lib/anexos-observacoes.ts) e, ao salvar, grava a lista nova e zera a
-- antiga. Nada do que ja esta salvo e perdido.
--
-- Codigo nao e tolerante: `colsCorridas` em fretamentos/page.tsx pede essa
-- coluna explicitamente. Execute no SQL Editor do Vangenda ANTES de publicar.
--
-- Idempotente.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS anexos_observacoes_urls JSONB;

NOTIFY pgrst, 'reload schema';
