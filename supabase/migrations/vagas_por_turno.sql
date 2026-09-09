-- Migration: contagem de vagas por TURNO explicito (fim da mistura ida/volta).
--
-- Bug recorrente (relatado de novo em 2026-09-09): cliente com 13
-- passageiros na ida ia agendar a volta e o sistema dizia que so havia 2
-- vagas — como se ida e volta dividissem o mesmo pool de 15 lugares.
--
-- CAUSA RAIZ: no caminho legado (rota sem saidas cadastradas em
-- horarios_rota), count_vagas_ocupadas identificava o turno pelo HORARIO DE
-- RELOGIO (p_horario comparado com horario_ida/horario_volta da rota). Se a
-- rota tem horario_ida = horario_volta (gestor preencheu igual), ou
-- registros de turnos diferentes caem no mesmo horario, as duas contagens
-- se somam no mesmo balde. Cada correcao anterior remendou uma tela, mas a
-- identificacao por relogio continuou aqui — por isso o bug sempre voltava.
--
-- CORRECAO DEFINITIVA: nova versao da funcao com p_turno explicito.
--   - agendamentos: a.turno = p_turno, direto. Chega de deduzir por relogio.
--   - corridas_empresa: sentido REAL via horario_rota_id -> horarios_rota.
--     Linha orfa (sem vinculo, das eras antigas) cai no relogio como antes —
--     e o unico dado que ela tem — mas nao contamina o outro turno quando o
--     vinculo existe.
--
-- A versao antiga de 3 parametros continua existindo (overload do Postgres)
-- de proposito: abas abertas do app continuam funcionando ate recarregar.
-- count_vagas_saida ja e correta por saida e nao muda.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

CREATE OR REPLACE FUNCTION count_vagas_ocupadas(
  p_rota_id   uuid,
  p_data      date,
  p_horario   text,   -- formato 'HH:MM' — usado so como fallback p/ linhas orfas
  p_turno     text    -- 'ida' | 'volta'
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int
     FROM corridas_empresa c
     LEFT JOIN horarios_rota hr ON hr.id = c.horario_rota_id
     WHERE c.rota_id = p_rota_id
       AND c.data_hora::date = p_data
       AND c.status != 'cancelada'
       -- So assento compartilhado ocupa vaga da van (mesma trava do
       -- carro_fechado_link_publico.sql).
       AND (c.tipo_servico IS NULL OR c.tipo_servico = 'rota_fixa')
       AND (
         -- Com vinculo: o sentido REAL da saida decide o turno.
         (c.horario_rota_id IS NOT NULL AND hr.sentido = p_turno)
         -- Linha orfa: relogio e o unico dado disponivel.
         OR (c.horario_rota_id IS NULL AND to_char(c.data_hora, 'HH24:MI') = p_horario)
       ))
    +
    (SELECT COUNT(*)::int
     FROM agendamentos a
     WHERE a.rota_id = p_rota_id
       AND a.data_viagem = p_data
       AND a.status != 'cancelado'
       AND a.turno = p_turno);
$$;

GRANT EXECUTE ON FUNCTION count_vagas_ocupadas(uuid, date, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
