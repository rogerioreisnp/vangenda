-- Migration: foto de perfil do motorista (app individual).
--
-- Contexto (2026-11-13): o app individual nao tinha perfil visivel nem botao
-- de sair a vista. Agora tem um circulo de perfil no topo da tela inicial
-- (foto ou inicial do nome) e o motorista envia a foto em Configuracoes >
-- Meu perfil. A foto tambem aparece no link de agendamento dos passageiros.
--
-- Bucket publico (a foto aparece no link publico, sem login). Escrita restrita
-- a pasta do proprio usuario: <user_id>/arquivo.jpg — ninguem troca ou apaga
-- a foto de outra pessoa.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS foto_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-perfil', 'fotos-perfil', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "fotos-perfil leitura publica" ON storage.objects;
CREATE POLICY "fotos-perfil leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-perfil');

DROP POLICY IF EXISTS "fotos-perfil upload propria pasta" ON storage.objects;
CREATE POLICY "fotos-perfil upload propria pasta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-perfil' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "fotos-perfil update propria pasta" ON storage.objects;
CREATE POLICY "fotos-perfil update propria pasta"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-perfil' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "fotos-perfil delete propria pasta" ON storage.objects;
CREATE POLICY "fotos-perfil delete propria pasta"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-perfil' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
