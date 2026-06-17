-- Migration: gestor pode editar e deletar agendamentos dos motoristas da empresa
-- Execute no Supabase SQL Editor

-- 1. Permitir que gestores atualizem agendamentos dos motoristas da empresa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'gestor_atualiza_agendamento_empresa'
  ) THEN
    CREATE POLICY "gestor_atualiza_agendamento_empresa" ON agendamentos
      FOR UPDATE TO authenticated
      USING (
        motorista_id IN (
          SELECT me.user_id FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid() AND me.user_id IS NOT NULL
        )
      )
      WITH CHECK (
        motorista_id IN (
          SELECT me.user_id FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid() AND me.user_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- 2. Permitir que gestores deletem agendamentos dos motoristas da empresa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'gestor_deleta_agendamento_empresa'
  ) THEN
    CREATE POLICY "gestor_deleta_agendamento_empresa" ON agendamentos
      FOR DELETE TO authenticated
      USING (
        motorista_id IN (
          SELECT me.user_id FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid() AND me.user_id IS NOT NULL
        )
      );
  END IF;
END $$;
