-- Migration: bucket 'logos-empresas' pro upload direto de logo pelo painel
-- da empresa. Antes o gestor tinha que colar URL manualmente (chato de
-- explicar em suporte). Agora ele escolhe o arquivo do celular e pronto.
-- Idempotente. Rode no SQL Editor do Vangenda.

-- 1) Cria o bucket publico (leitura sem auth, escrita so autenticado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos-empresas', 'logos-empresas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Policies: qualquer um le, so gestor autenticado escreve/deleta
--    (RLS de storage.objects e feita atraves dessas policies)

-- Leitura publica (qualquer visitante ve a logo no link publico)
DROP POLICY IF EXISTS "logos-empresas leitura publica" ON storage.objects;
CREATE POLICY "logos-empresas leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos-empresas');

-- Upload / update / delete: qualquer usuario autenticado (o gestor da empresa)
DROP POLICY IF EXISTS "logos-empresas upload autenticado" ON storage.objects;
CREATE POLICY "logos-empresas upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos-empresas');

DROP POLICY IF EXISTS "logos-empresas update autenticado" ON storage.objects;
CREATE POLICY "logos-empresas update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos-empresas');

DROP POLICY IF EXISTS "logos-empresas delete autenticado" ON storage.objects;
CREATE POLICY "logos-empresas delete autenticado"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos-empresas');
