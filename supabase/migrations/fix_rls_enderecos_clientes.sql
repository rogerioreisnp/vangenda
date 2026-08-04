-- Corrige RLS de enderecos_clientes pro GESTOR autenticado.
--
-- Bug: a policy original (migration_transfer.sql) compara
-- "gestores.id = auth.uid()", mas gestores.id e a PK da tabela (um uuid
-- aleatorio) -- o auth.uid() do gestor fica em gestores.user_id. Como as
-- duas colunas nunca coincidem, a policy sempre bloqueava o gestor
-- autenticado (SELECT/INSERT/UPDATE), tanto pra ler quanto pra gravar.
--
-- So nao dava pra perceber antes porque, ate agora, so o link publico
-- (role anon, com suas proprias policies "anon_*") tocava essa tabela.
-- A funcionalidade de "enderecos salvos" no formulario interno (gestor
-- logado) foi o primeiro caminho a usar essa tabela como authenticated,
-- e ficou silenciosamente sem gravar nem ler nada -- caso AAJP
-- Transportes / Alexandre, 2026-08-04.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

DROP POLICY IF EXISTS "Empresa vê apenas seus endereços" ON enderecos_clientes;

CREATE POLICY "gestor_gerencia_enderecos_clientes"
ON enderecos_clientes
FOR ALL TO authenticated
USING (empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
