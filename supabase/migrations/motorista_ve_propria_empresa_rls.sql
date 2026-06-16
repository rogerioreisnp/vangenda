-- Permite que motoristas de empresa leiam o registro da própria empresa.
-- Necessário para a tela de Config. mostrar o link público da empresa
-- em vez do link individual do motorista.
-- A policy anon_select_empresas_publico cobre apenas a role anon (página pública);
-- motoristas autenticados precisam desta policy separada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empresas' AND policyname = 'motorista_le_propria_empresa'
  ) THEN
    CREATE POLICY "motorista_le_propria_empresa" ON empresas
      FOR SELECT TO authenticated
      USING (
        id IN (
          SELECT empresa_id FROM motoristas_empresa WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
