-- =====================================================
-- MIGRATION: Função para busca de usuário por email
-- Usada pelo webhook do Kiwify para ativar assinaturas
-- sem depender da paginação limitada do listUsers()
--
-- Execute no Supabase: SQL Editor → New Query
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- Garante que a service role (usada pela API) pode chamar a função
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO service_role;
