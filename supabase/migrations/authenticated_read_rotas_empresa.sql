-- Permite que usuários autenticados leiam todas as rotas_empresa.
-- Necessário porque as policies existentes (anon_select_rotas_empresa,
-- public_read_rotas_empresa) são restritas à role anon, e o RLS bloqueia
-- silenciosamente a role authenticated sem policy explícita de SELECT.
--
-- Contexto: motoristas de empresa precisam ler rotas_empresa da sua empresa
-- no /dashboard (Etapa 2). A policy do gestor (gestor_ve_rotas) usa FOR ALL
-- mas só cobre quem está em gestores; motoristas autenticados não tinham cobertura.

CREATE POLICY "authenticated_read_rotas_empresa"
  ON rotas_empresa
  FOR SELECT
  TO authenticated
  USING (true);
