-- Migration: gestor pode criar agendamentos para motoristas da empresa
-- Execute no Supabase SQL Editor

-- 1. Tornar rota_id opcional (motoristas de empresa não têm rota pessoal obrigatória)
ALTER TABLE agendamentos ALTER COLUMN rota_id DROP NOT NULL;

-- 2. Permitir que gestores insiram agendamentos para motoristas da empresa
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

-- 3. Permitir que gestores leiam agendamentos dos motoristas da empresa
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
