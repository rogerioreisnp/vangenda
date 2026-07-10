-- Migration: (1) motorista funcionário passa a ler/gravar agendamentos,
-- encomendas, fretamentos e movimentações da empresa dele (o padrão da
-- Etapa A grava esses registros com motorista_id = gestor da empresa, e as
-- policies antigas só permitem auth.uid() = motorista_id, o que bloqueia o
-- funcionário); (2) count_vagas_ocupadas passa a somar os agendamentos que o
-- gestor cadastra em /dashboard/agenda (tabela `agendamentos`) além dos que
-- chegam pelo link público (tabela `corridas_empresa`), para a capacidade
-- exibida no link público realmente decrescer.
--
-- Idempotente e seguro rodar mais de uma vez. Execute no SQL Editor do
-- Supabase do Vangenda (não do Smart Car).

-- ── 1. Função SECURITY DEFINER: user_ids dos gestores da empresa do
--       motorista funcionário logado. Contorna o RLS de `gestores` (que só
--       deixa o próprio gestor ver o próprio registro) e evita o padrão de
--       policy que consulta outra tabela com RLS — recursão/500 já
--       documentado no memory feedback_rls_recursion.
CREATE OR REPLACE FUNCTION gestores_da_empresa_do_motorista_logado()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT g.user_id
  FROM gestores g
  WHERE g.empresa_id IN (
    SELECT me.empresa_id
    FROM motoristas_empresa me
    WHERE me.user_id = auth.uid()
      AND me.status = 'ativo'
  );
$$;

GRANT EXECUTE ON FUNCTION gestores_da_empresa_do_motorista_logado() TO authenticated;

-- ── 2. Policies em `agendamentos` para motorista funcionário ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'funcionario_agendamentos_via_gestor'
  ) THEN
    CREATE POLICY "funcionario_agendamentos_via_gestor" ON agendamentos
      FOR ALL TO authenticated
      USING (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()))
      WITH CHECK (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()));
  END IF;
END $$;

-- ── 3. Policies em `encomendas` para motorista funcionário ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'encomendas' AND policyname = 'funcionario_encomendas_via_gestor'
  ) THEN
    CREATE POLICY "funcionario_encomendas_via_gestor" ON encomendas
      FOR ALL TO authenticated
      USING (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()))
      WITH CHECK (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()));
  END IF;
END $$;

-- ── 4. Policies em `fretamentos` para motorista funcionário ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fretamentos' AND policyname = 'funcionario_fretamentos_via_gestor'
  ) THEN
    CREATE POLICY "funcionario_fretamentos_via_gestor" ON fretamentos
      FOR ALL TO authenticated
      USING (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()))
      WITH CHECK (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()));
  END IF;
END $$;

-- ── 5. Policies em `movimentacoes` para motorista funcionário ────────────────
-- Necessário porque encomendas fiadas geram um insert em movimentacoes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'movimentacoes' AND policyname = 'funcionario_movimentacoes_via_gestor'
  ) THEN
    CREATE POLICY "funcionario_movimentacoes_via_gestor" ON movimentacoes
      FOR ALL TO authenticated
      USING (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()))
      WITH CHECK (motorista_id IN (SELECT gestores_da_empresa_do_motorista_logado()));
  END IF;
END $$;

-- ── 6. FK de agendamentos.rota_id ── não vamos exigir referência a `rotas`
-- porque o gestor de empresa grava com id de `rotas_empresa`.
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_rota_id_fkey;

-- ── 7. RPC count_vagas_ocupadas: somar também `agendamentos` do gestor ───────
CREATE OR REPLACE FUNCTION count_vagas_ocupadas(
  p_rota_id   uuid,
  p_data      date,
  p_horario   text   -- formato 'HH:MM'
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int
     FROM corridas_empresa
     WHERE rota_id = p_rota_id
       AND data_hora::date = p_data
       AND to_char(data_hora, 'HH24:MI') = p_horario
       AND status != 'cancelada')
    +
    (SELECT COUNT(*)::int
     FROM agendamentos a
     JOIN rotas_empresa re ON re.id = p_rota_id
     WHERE a.rota_id = p_rota_id
       AND a.data_viagem = p_data
       AND a.status != 'cancelado'
       AND (
         (a.turno = 'ida'   AND to_char(re.horario_ida,   'HH24:MI') = p_horario)
         OR (a.turno = 'volta' AND to_char(re.horario_volta, 'HH24:MI') = p_horario)
       ));
$$;

GRANT EXECUTE ON FUNCTION count_vagas_ocupadas(uuid, date, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
