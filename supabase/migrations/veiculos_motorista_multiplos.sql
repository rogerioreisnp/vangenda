-- Migration: múltiplos veículos por motorista (Julimar, 2026-07-17).
--
-- Contexto: motorista pode ter carro próprio + carro cedido pelo Julimar,
-- ou trocar de veículo com frequência (terceirizado com frota própria).
-- Hoje `motoristas_empresa` só tem 1 veículo fixo (colunas veiculo/placa/cor).
--
-- Solução: nova tabela veiculos_motorista (1 motorista → N veículos, até 5
-- por regra de negócio aplicada no app). As colunas antigas veiculo/placa/cor
-- em motoristas_empresa NÃO são removidas — continuam sendo o "veículo
-- principal" (mirror do primeiro veículo cadastrado), pra tudo que já lê
-- essas colunas direto (mensagem de WhatsApp pro cliente, tela de config
-- do motorista, financeiro) continuar funcionando sem precisar de mudança.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

CREATE TABLE IF NOT EXISTS veiculos_motorista (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_empresa_id  uuid NOT NULL REFERENCES motoristas_empresa(id) ON DELETE CASCADE,
  veiculo               text,
  placa                 text,
  cor                   text,
  ordem                 integer NOT NULL DEFAULT 0,
  criado_em             timestamptz DEFAULT now()
);

ALTER TABLE veiculos_motorista ENABLE ROW LEVEL SECURITY;

-- Gestor gerencia (CRUD) veículos dos motoristas da própria empresa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'veiculos_motorista' AND policyname = 'gestor_gerencia_veiculos_motorista'
  ) THEN
    CREATE POLICY "gestor_gerencia_veiculos_motorista" ON veiculos_motorista
      FOR ALL TO authenticated
      USING (
        motorista_empresa_id IN (
          SELECT me.id FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid()
        )
      )
      WITH CHECK (
        motorista_empresa_id IN (
          SELECT me.id FROM motoristas_empresa me
          INNER JOIN gestores g ON g.empresa_id = me.empresa_id
          WHERE g.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Motorista funcionário lê os próprios veículos (só leitura — só o gestor
-- cadastra/edita, conforme pedido do Julimar).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'veiculos_motorista' AND policyname = 'motorista_le_proprios_veiculos'
  ) THEN
    CREATE POLICY "motorista_le_proprios_veiculos" ON veiculos_motorista
      FOR SELECT TO authenticated
      USING (
        motorista_empresa_id IN (
          SELECT id FROM motoristas_empresa WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Migra dados existentes: motoristas que já têm veiculo/placa/cor
-- preenchidos na coluna antiga viram o primeiro registro na tabela nova.
-- Idempotente: só insere se ainda não existir nenhum veículo pra esse
-- motorista (evita duplicar em reexecuções).
INSERT INTO veiculos_motorista (motorista_empresa_id, veiculo, placa, cor, ordem)
SELECT id, veiculo, placa, cor, 0
FROM motoristas_empresa me
WHERE (veiculo IS NOT NULL OR placa IS NOT NULL OR cor IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM veiculos_motorista vm WHERE vm.motorista_empresa_id = me.id
  );

NOTIFY pgrst, 'reload schema';
