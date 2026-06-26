-- Função pública para contar vagas ocupadas em corridas_empresa
-- SECURITY DEFINER: roda como owner, bypassa RLS — expõe apenas a contagem, sem dados pessoais
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
  SELECT COUNT(*)::int
  FROM corridas_empresa
  WHERE rota_id = p_rota_id
    AND data_hora::date = p_data
    AND to_char(data_hora, 'HH24:MI') = p_horario
    AND status != 'cancelada';
$$;

-- Concede execução para anon e authenticated
GRANT EXECUTE ON FUNCTION count_vagas_ocupadas(uuid, date, text) TO anon, authenticated;
