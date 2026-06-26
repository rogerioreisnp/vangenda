-- ============================================================
-- Migração: corrigir trigger handle_new_user
-- Data: 2026-06-25
-- Objetivo:
--   1. Não criar registro fantasma em motoristas para gestores
--      de empresa (identificados por raw_user_meta_data->>'tipo' = 'gestor')
--   2. Garantir que todo motorista individual nasce com
--      assinatura_status = 'trial' e assinatura_expira = NOW() + 10 dias
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Gestores de empresa usam a tabela gestores, não motoristas
  IF NEW.raw_user_meta_data->>'tipo' = 'gestor' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.motoristas (id, nome, telefone, trial_inicio, assinatura_status, assinatura_expira)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'telefone',
    NOW(),
    'trial',
    NOW() + INTERVAL '10 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Verificação: gestores que geraram motorista fantasma ──────
-- Liste os gestores que têm registro duplicado na tabela motoristas
-- (pode deletar esses registros se não tiverem dados importantes)
SELECT g.nome, g.email, g.empresa_id
FROM gestores g
JOIN motoristas m ON m.id = g.user_id;
