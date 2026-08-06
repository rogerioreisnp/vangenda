-- Carro fechado no rota fixa — ETAPA 3 (link publico).
--
-- 1) Quantas pessoas vao no carro fechado. Uma reserva normal da rota gera
--    UMA LINHA POR PASSAGEIRO (e assim que a lotacao e contada). Carro
--    fechado e o contrario: um veiculo so, uma linha so — entao o tamanho do
--    grupo precisa de campo proprio, senao o gestor nao sabe qual carro
--    mandar (a frota da ASF e de 4 e 6 lugares).
--
-- 2) TRAVA DE SEGURANCA nas duas funcoes que contam vaga.
--
--    Hoje elas somam QUALQUER linha de corridas_empresa daquela rota, data e
--    horario — sem olhar o tipo de servico. Como carro fechado grava na
--    mesma tabela e na mesma rota, se o horario pedido pelo cliente batesse
--    com o de uma saida, o carro fechado passaria a ocupar lugares da van.
--    Seria exatamente o bug que o Alexandre sofreu antes ("eu so tenho 4, e
--    se der um estopim de passageiros e reservar 12 eu nao vou ter como
--    levar 12"), so que por outro caminho.
--
--    A trava: contar so o que e assento compartilhado de verdade —
--    tipo_servico 'rota_fixa' ou NULL (registros antigos, de antes do campo
--    existir). Carro fechado, fretamento e excursao deixam de entrar na
--    conta.
--
--    Isso NAO altera nada do que ja funciona: toda reserva vinda do link
--    publico grava tipo_servico='rota_fixa' e continua sendo contada igual.
--    De quebra corrige uma falha que ja existia — fretamento e excursao
--    lancados na mesma rota e horario tambem comiam vaga da van sem motivo.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS quantidade_passageiros INTEGER;

-- ── Contagem por SAIDA (usada quando a rota tem horarios cadastrados) ─────
CREATE OR REPLACE FUNCTION count_vagas_saida(p_horario_id uuid, p_data date)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH h AS (
    SELECT hr.id, hr.rota_id, hr.horario, hr.sentido,
           to_char(hr.horario, 'HH24:MI') AS hhmm,
           (to_char(hr.horario, 'HH24:MI') = to_char(
              CASE WHEN hr.sentido = 'ida' THEN re.horario_ida ELSE re.horario_volta END,
              'HH24:MI')) AS eh_legada
    FROM horarios_rota hr
    JOIN rotas_empresa re ON re.id = hr.rota_id
    WHERE hr.id = p_horario_id
  )
  SELECT
    (SELECT COUNT(*)::int
       FROM corridas_empresa c, h
      WHERE c.rota_id = h.rota_id
        AND c.data_hora::date = p_data
        AND c.status <> 'cancelada'
        -- So assento compartilhado ocupa vaga da van.
        AND (c.tipo_servico IS NULL OR c.tipo_servico = 'rota_fixa')
        AND (
          c.horario_rota_id = h.id
          OR (c.horario_rota_id IS NULL AND h.eh_legada
              AND to_char(c.data_hora, 'HH24:MI') = h.hhmm)
        ))
    +
    (SELECT COUNT(*)::int
       FROM agendamentos a, h
      WHERE a.rota_id = h.rota_id
        AND a.data_viagem = p_data
        AND a.status <> 'cancelado'
        AND (
          a.horario_rota_id = h.id
          OR (a.horario_rota_id IS NULL AND h.eh_legada AND a.turno = h.sentido)
        ));
$$;

GRANT EXECUTE ON FUNCTION count_vagas_saida(uuid, date) TO anon, authenticated;

-- ── Contagem legada por horario de relogio (rota sem saidas cadastradas) ──
CREATE OR REPLACE FUNCTION count_vagas_ocupadas(
  p_rota_id   uuid,
  p_data      date,
  p_horario   text
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int
     FROM corridas_empresa
     WHERE rota_id = p_rota_id
       AND data_hora::date = p_data
       AND to_char(data_hora, 'HH24:MI') = p_horario
       AND status != 'cancelada'
       -- Mesma trava da funcao acima.
       AND (tipo_servico IS NULL OR tipo_servico = 'rota_fixa'))
    +
    (SELECT COUNT(*)::int
     FROM agendamentos a
     JOIN rotas_empresa re ON re.id = p_rota_id
     WHERE a.rota_id = p_rota_id
       AND a.data_viagem = p_data
       AND a.status != 'cancelado'
       AND (
         (a.turno = 'ida'   AND to_char(re.horario_ida,   'HH24:MI') = p_horario)
         OR (a.turno = 'volta' AND to_char(re.horario_volta, 'HH24:MI') = p_horario)
       ));
$$;

GRANT EXECUTE ON FUNCTION count_vagas_ocupadas(uuid, date, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
