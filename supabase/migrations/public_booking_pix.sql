-- Migration: suporte completo à página pública de agendamento com Pix
-- Idempotente: segura para rodar mesmo que parte já exista no banco.
-- Execute no SQL Editor do painel do Supabase.

-- ─── 1. Garante colunas de personalização na tabela empresas ────────────────
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS slug              TEXT UNIQUE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS descricao         TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor_destaque      TEXT DEFAULT '#1D9E75';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url          TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS chave_pix         TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tipo_chave_pix    TEXT DEFAULT 'telefone';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj              TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email_comercial   TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cidade            TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS estado            TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS qtd_veiculos      INTEGER;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS instagram         TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp_comercial TEXT;

-- ─── 2. RLS pública: anon pode ler empresas com slug (página de booking) ────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empresas' AND policyname = 'anon_select_empresas_publico'
  ) THEN
    CREATE POLICY "anon_select_empresas_publico" ON empresas
      FOR SELECT TO anon
      USING (slug IS NOT NULL);
  END IF;
END $$;

-- ─── 3. RLS pública: anon pode ler rotas da empresa (para listar no form) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rotas_empresa' AND policyname = 'anon_select_rotas_empresa'
  ) THEN
    CREATE POLICY "anon_select_rotas_empresa" ON rotas_empresa
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ─── 4. RLS pública: anon pode inserir corridas (submeter agendamento) ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corridas_empresa' AND policyname = 'anon_insert_corridas_empresa'
  ) THEN
    CREATE POLICY "anon_insert_corridas_empresa" ON corridas_empresa
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- ─── 5. Diagnóstico: mostra o estado atual das policies e colunas ────────────
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('empresas', 'rotas_empresa', 'corridas_empresa')
ORDER BY tablename, policyname;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'empresas'
  AND column_name IN ('chave_pix', 'tipo_chave_pix', 'slug', 'cor_destaque', 'logo_url')
ORDER BY column_name;
