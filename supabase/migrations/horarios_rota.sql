-- Varias saidas (horarios) por rota — rota fixa.
--
-- Contexto (equipe do Alexandre / ASF, Recife — 2026-08-04). A Emanuela
-- insistiu varias vezes: "o horario tem que estar flexivel, ele nao pode
-- estar amarrado". Exemplo dela: horario padrao e 07:00 saindo de Recife e
-- 14:00 voltando de Maceio, mas ela dormiu em Maceio, saiu de Recife 13:00 e
-- so voltou 04:00 do dia seguinte — "meu horario nao teve nada a ver um com
-- o outro". E o fecho: "ele pode ter um horario determinado pra Maria, pro
-- Jose, pro Joao, COM a flexibilidade de alterar de acordo com a necessidade
-- da reserva".
--
-- Ou seja: o horario nao pertence a ROTA, pertence a SAIDA. A rota e o
-- produto comercial (trajeto, paradas, precos); a saida e a operacao (hora,
-- veiculo, motorista, lotacao). Mesma rota pode ter N saidas no mesmo dia,
-- cada uma com seu motorista — o que tambem resolve o caso do parceiro:
-- Alexandre esta rodando a das 13h, aparece outro grupo, ele cria a saida
-- das 15h e atribui pra Emanuela.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

-- ── 1. Saidas da rota ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios_rota (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id       UUID NOT NULL REFERENCES rotas_empresa(id) ON DELETE CASCADE,
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  horario       TIME NOT NULL,
  sentido       TEXT NOT NULL CHECK (sentido IN ('ida','volta')),
  -- Cada saida pode ter motorista e veiculo proprios. NULL = usa o da rota.
  motorista_id  UUID REFERENCES motoristas_empresa(id) ON DELETE SET NULL,
  veiculo_placa TEXT,
  -- Lotacao da saida. NULL = usa a capacidade da rota (van diferente por
  -- saida e comum: a das 5h vai de van, a das 13h vai de carro).
  capacidade    INTEGER,
  -- Dias em que ESTA saida opera. NULL = mesmos dias da rota.
  dias_semana   INTEGER[],
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS horarios_rota_rota_idx ON horarios_rota (rota_id, sentido, horario);

ALTER TABLE horarios_rota ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Gestor gerencia as saidas da propria empresa.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'horarios_rota' AND policyname = 'gestor_gerencia_horarios_rota') THEN
    CREATE POLICY "gestor_gerencia_horarios_rota" ON horarios_rota
      FOR ALL TO authenticated
      USING (empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()))
      WITH CHECK (empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()));
  END IF;

  -- Motorista funcionario le as saidas da empresa dele (pra ver a agenda).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'horarios_rota' AND policyname = 'funcionario_le_horarios_rota') THEN
    CREATE POLICY "funcionario_le_horarios_rota" ON horarios_rota
      FOR SELECT TO authenticated
      USING (empresa_id IN (SELECT empresas_do_motorista_logado()));
  END IF;

  -- Link publico (anon) precisa listar as saidas pra o passageiro escolher.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'horarios_rota' AND policyname = 'anon_le_horarios_rota') THEN
    CREATE POLICY "anon_le_horarios_rota" ON horarios_rota
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ── 2. A reserva guarda DE QUAL SAIDA ela e ──────────────────────────────
-- Isso e o pulo do gato do controle de lotacao: hoje a contagem tenta
-- adivinhar a saida comparando texto de relogio, entao qualquer ajuste de
-- horario quebrava a conta. Amarrando na saida, o gestor pode mudar o
-- horario de uma reserva sem bagunçar a vaga de ninguem.
ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS horario_rota_id UUID REFERENCES horarios_rota(id) ON DELETE SET NULL;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS horario_rota_id UUID REFERENCES horarios_rota(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS corridas_empresa_horario_idx ON corridas_empresa (horario_rota_id) WHERE horario_rota_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agendamentos_horario_idx ON agendamentos (horario_rota_id) WHERE horario_rota_id IS NOT NULL;

-- ── 3. Backfill: toda rota que existe hoje vira 1 saida de ida + 1 de volta
-- Ninguem percebe mudanca nenhuma — a rota continua com os mesmos horarios,
-- so que agora eles moram no lugar certo e podem ser multiplicados.
INSERT INTO horarios_rota (rota_id, empresa_id, horario, sentido, motorista_id, veiculo_placa, capacidade, ordem)
SELECT re.id, re.empresa_id, re.horario_ida, 'ida', re.motorista_id, re.veiculo_placa, re.capacidade, 0
FROM rotas_empresa re
WHERE re.horario_ida IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM horarios_rota h
    WHERE h.rota_id = re.id AND h.sentido = 'ida' AND h.horario = re.horario_ida
  );

INSERT INTO horarios_rota (rota_id, empresa_id, horario, sentido, motorista_id, veiculo_placa, capacidade, ordem)
SELECT re.id, re.empresa_id, re.horario_volta, 'volta', re.motorista_id, re.veiculo_placa, re.capacidade, 0
FROM rotas_empresa re
WHERE re.horario_volta IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM horarios_rota h
    WHERE h.rota_id = re.id AND h.sentido = 'volta' AND h.horario = re.horario_volta
  );

-- ── 4. Contagem de vagas POR SAIDA ───────────────────────────────────────
-- Conta as duas origens de passageiro (link publico -> corridas_empresa,
-- gestor -> agendamentos) e ainda cobre as reservas ANTIGAS, que nao tem
-- horario_rota_id: essas caem no fallback por horario de relogio, mas so
-- na saida que corresponde ao horario original da rota — senao uma reserva
-- antiga seria contada em todas as saidas do mesmo sentido.
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
           -- a saida "legada" e a que bate com o horario original da rota
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

NOTIFY pgrst, 'reload schema';
