-- Permite que motoristas de empresa leiam o próprio registro ao fazer login.
-- Necessário para que a verificação em app/page.tsx funcione com o JWT do motorista.
CREATE POLICY "motorista_ve_proprio_registro" ON motoristas_empresa
  FOR SELECT USING (user_id = auth.uid());
