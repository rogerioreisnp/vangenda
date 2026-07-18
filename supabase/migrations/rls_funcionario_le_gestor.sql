-- Migration: motorista funcionário pode LER o registro do gestor da
-- empresa dele na tabela `gestores`.
--
-- CAUSA RAIZ do bug "gestor agenda e não aparece pro motorista" (e do
-- inverso, "motorista agenda e não aparece pro gestor") no rota_fixa:
--
-- Todo agendamento/encomenda é salvo com motorista_id = user_id do GESTOR
-- (padrão Etapa A — o financeiro pertence ao dono). Para isso, o app do
-- motorista precisa DESCOBRIR o user_id do gestor consultando `gestores`:
--   - app/dashboard/agenda/page.tsx (detectarEmpresa)
--   - app/dashboard/page.tsx (home do motorista)
--   - lib/motorista-salvar.ts (getMotoristaIdSalvar)
--
-- Mas `gestores` só tinha policies pro PRÓPRIO gestor (user_id = auth.uid()).
-- A consulta do funcionário voltava vazia → o app caía no fallback e usava
-- o user_id do próprio funcionário → agenda vazia num sentido, e no outro
-- sentido os registros criados pelo motorista iam pro id errado e o gestor
-- não via.
--
-- Esta policy destrava a cadeia inteira SEM alterar nenhuma linha de código
-- que já funciona.
--
-- Usa função SECURITY DEFINER pra evitar recursão de RLS: uma policy em
-- `gestores` que consultasse `motoristas_empresa` diretamente dispararia a
-- policy `gestor_ve_motoristas` (que consulta `gestores` de volta) → loop
-- "infinite recursion detected in policy". Padrão já documentado no projeto.
--
-- Idempotente. Execute no SQL Editor do Vangenda (não Smart Car).

-- Função: empresas às quais o usuário logado pertence como motorista ativo.
-- SECURITY DEFINER bypassa RLS internamente — expõe apenas empresa_ids.
CREATE OR REPLACE FUNCTION empresas_do_motorista_logado()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT empresa_id
  FROM motoristas_empresa
  WHERE user_id = auth.uid()
    AND status = 'ativo';
$$;

GRANT EXECUTE ON FUNCTION empresas_do_motorista_logado() TO authenticated;

-- Policy: funcionário lê a(s) linha(s) de gestores da(s) empresa(s) dele.
-- Escopo: SELECT apenas. O funcionário passa a ver nome/email do gestor da
-- própria empresa — aceitável (é o chefe dele) e necessário pro app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gestores'
      AND policyname = 'funcionario_le_gestor_da_empresa'
  ) THEN
    CREATE POLICY "funcionario_le_gestor_da_empresa" ON gestores
      FOR SELECT TO authenticated
      USING (
        empresa_id IN (SELECT empresas_do_motorista_logado())
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
