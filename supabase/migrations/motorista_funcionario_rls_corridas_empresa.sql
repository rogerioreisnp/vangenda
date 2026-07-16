-- Migration: motorista funcionário da empresa transfer pode ler e atualizar
-- corridas_empresa da empresa dele.
--
-- Bug real: policy antiga `gestor_ve_corridas` (empresarial_etapa1.sql) só
-- deixa o gestor acessar. Motorista funcionário do transfer não consegue
-- nem VER as próprias corridas atribuídas — a agenda em /motorista/agenda
-- fica vazia mesmo com dados.
--
-- Rota_fixa não sofre porque motorista funcionário lê `agendamentos` (RLS
-- liberado antes em motorista_funcionario_rls_e_vagas.sql). Transfer usa
-- `corridas_empresa`, que ficou de fora.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

-- Motorista funcionário LÊ todas as corridas da empresa dele (ele precisa
-- ver corridas atribuídas + as de colegas pra saber quem tá fazendo o quê).
-- Sem policy, a app do motorista mostra agenda vazia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corridas_empresa'
      AND policyname = 'funcionario_corridas_empresa_select'
  ) THEN
    CREATE POLICY "funcionario_corridas_empresa_select" ON corridas_empresa
      FOR SELECT TO authenticated
      USING (
        empresa_id IN (
          SELECT empresa_id FROM motoristas_empresa
          WHERE user_id = auth.uid() AND status = 'ativo'
        )
      );
  END IF;
END $$;

-- Motorista funcionário ATUALIZA APENAS as corridas atribuídas a ele:
-- KM inicial/final, status (em_andamento/concluida), trajetos.
-- Não pode alterar corridas de outros nem editar valor/cliente/etc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corridas_empresa'
      AND policyname = 'funcionario_corridas_empresa_update_propria'
  ) THEN
    CREATE POLICY "funcionario_corridas_empresa_update_propria" ON corridas_empresa
      FOR UPDATE TO authenticated
      USING (
        motorista_id IN (
          SELECT id FROM motoristas_empresa
          WHERE user_id = auth.uid() AND status = 'ativo'
        )
      )
      WITH CHECK (
        motorista_id IN (
          SELECT id FROM motoristas_empresa
          WHERE user_id = auth.uid() AND status = 'ativo'
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
