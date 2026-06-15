-- Migration: RLS policies para cadastro empresarial
-- Permite que usuário autenticado insira sua própria empresa e se registre como gestor
-- Executar no Supabase SQL Editor

-- Permitir que usuário autenticado insira sua própria empresa
CREATE POLICY "usuarios podem criar empresa"
ON empresas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir que usuário autenticado insira a si mesmo como gestor
CREATE POLICY "usuarios podem se tornar gestor"
ON gestores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
