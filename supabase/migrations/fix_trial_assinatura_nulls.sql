-- ============================================================
-- Migração: corrigir trial_fim e assinatura_expira nulos
-- Data: 2026-06-25
-- ============================================================

-- ── PASSO 1: Corrigir trigger handle_new_user ────────────────
-- Motoristas individuais devem nascer em trial com assinatura_expira definida.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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

-- ── PASSO 2: Corrigir empresas com trial_fim NULL ────────────
-- Preservar Pedro Transportes (id = e4aee8cf-7230-4923-a896-76a3b9292e5c)
UPDATE empresas
SET
  trial_fim = trial_inicio + INTERVAL '15 days',
  status    = 'trial'
WHERE trial_fim IS NULL
  AND id != 'e4aee8cf-7230-4923-a896-76a3b9292e5c';

-- ── PASSO 3: Corrigir motoristas com assinatura_expira NULL ──
-- Usa criado_em como referência; quem passou de 10 dias ficará expirado.
UPDATE motoristas
SET
  assinatura_expira   = criado_em + INTERVAL '10 days',
  assinatura_status   = 'trial'
WHERE assinatura_expira IS NULL;

-- ── PASSO 4: Verificação ─────────────────────────────────────

-- Conferir empresas (ordenadas por trial_fim, NULLs por último)
SELECT nome, status, trial_inicio, trial_fim
FROM empresas
ORDER BY trial_fim DESC NULLS LAST;

-- Conferir motoristas com situação suspeita
SELECT m.nome, m.assinatura_status, m.assinatura_expira
FROM motoristas m
WHERE m.assinatura_expira IS NULL
   OR m.assinatura_expira > '2026-12-31';
