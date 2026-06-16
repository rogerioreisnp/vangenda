-- Etapa 2: policies para motoristas de empresa lerem rotas e paradas da sua empresa.
-- Execute no SQL Editor do painel do Supabase.
-- Idempotente: seguro rodar mesmo que parte já exista.

-- ── 1. motorista pode LER rotas da sua empresa ────────────────────────────────
-- (rotas_empresa já tem RLS habilitado desde empresarial_etapa1.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rotas_empresa'
      AND policyname = 'motorista_ve_rotas_empresa'
  ) THEN
    CREATE POLICY "motorista_ve_rotas_empresa" ON rotas_empresa
      FOR SELECT USING (
        empresa_id IN (
          SELECT empresa_id FROM motoristas_empresa WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 2. paradas_empresa: habilita RLS e garante policies ──────────────────────
-- Se RLS não estava habilitado, habilita agora.
-- A policy do gestor é criada só se não existir (evita quebrar caso já exista).
ALTER TABLE paradas_empresa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'paradas_empresa'
      AND policyname = 'gestor_ve_paradas_empresa'
  ) THEN
    CREATE POLICY "gestor_ve_paradas_empresa" ON paradas_empresa
      FOR ALL USING (
        empresa_id IN (
          SELECT empresa_id FROM gestores WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'paradas_empresa'
      AND policyname = 'motorista_ve_paradas_empresa'
  ) THEN
    CREATE POLICY "motorista_ve_paradas_empresa" ON paradas_empresa
      FOR SELECT USING (
        empresa_id IN (
          SELECT empresa_id FROM motoristas_empresa WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Diagnóstico: mostra as policies criadas ───────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('rotas_empresa', 'paradas_empresa')
ORDER BY tablename, policyname;
