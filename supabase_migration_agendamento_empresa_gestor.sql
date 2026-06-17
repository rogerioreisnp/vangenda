-- Migration: gestor pode criar agendamentos para motoristas da empresa
-- Execute no Supabase SQL Editor

-- 1. Tornar rota_id opcional (motoristas de empresa não têm rota pessoal obrigatória)
ALTER TABLE agendamentos ALTER COLUMN rota_id DROP NOT NULL;

-- 2. Corrigir FK: motoristas de empresa têm user_id em auth.users mas podem não ter
--    row em motoristas (tabela de perfil individual). Referenciar auth.users diretamente.
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_motorista_id_fkey;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_motorista_id_fkey
  FOREIGN KEY (motorista_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Permitir que gestores insiram agendamentos para motoristas da empresa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'gestor_insere_agendamento_empresa'
  ) THEN
    CREATE POLICY "gestor_insere_agendamento_empresa" ON agendamentos
      FOR INSERT TO authenticated
      WITH CHECK (
        motorista_id IN (
          SELECT me.user_id
          FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid()
            AND me.user_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- 4. Permitir que gestores leiam agendamentos dos motoristas da empresa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'gestor_le_agendamentos_empresa'
  ) THEN
    CREATE POLICY "gestor_le_agendamentos_empresa" ON agendamentos
      FOR SELECT TO authenticated
      USING (
        motorista_id IN (
          SELECT me.user_id
          FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid()
            AND me.user_id IS NOT NULL
        )
      );
  END IF;
END $$;
