-- ============================================================
-- Correção: Policy SELECT para gestores em solicitacoes_transfer
-- Execute no Supabase > SQL Editor se as solicitações não aparecerem no painel
-- ============================================================

-- Diagnóstico: quantos registros existem?
select id, empresa_id, nome_cliente, origem, destino, data, status, created_at
from solicitacoes_transfer
order by created_at desc
limit 10;

-- Se houver dados acima mas o painel mostrar vazio, o problema é RLS.
-- Execute o bloco abaixo para garantir que gestores podem ver suas solicitações:

DROP POLICY IF EXISTS "Gestor ve suas solicitacoes" ON solicitacoes_transfer;
CREATE POLICY "Gestor ve suas solicitacoes"
ON solicitacoes_transfer
FOR SELECT TO authenticated
USING (
  empresa_id = (
    SELECT empresa_id FROM gestores WHERE id = auth.uid()
  )
);

-- Confirma que as policies estão corretas:
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'solicitacoes_transfer';
