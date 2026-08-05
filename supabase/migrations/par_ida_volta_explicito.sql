-- Vinculo EXPLICITO do par ida-volta (transfer).
--
-- Contexto (Julimar, 2026-08-05): ele criou dois atendimentos diferentes
-- pro mesmo cliente — uma Diaria pra amanha e um Transfer pra depois de
-- amanha — e o sistema juntou os dois num card so, como se fossem ida e
-- volta do mesmo servico.
--
-- Causa: o sistema nunca gravou que duas corridas formam um par. Ele
-- ADIVINHAVA, comparando nome do cliente + created_at proximo (janela de
-- 5 min) + telefone. Dois agendamentos seguidos pro mesmo cliente batem
-- em todos esses criterios, mesmo sendo servicos completamente
-- diferentes, em dias diferentes.
--
-- Correcao: quando o gestor marca "Ida e volta", as duas linhas nascem
-- com o MESMO par_id. O agrupamento passa a ler esse vinculo em vez de
-- adivinhar. Registros antigos (par_id nulo) continuam caindo na
-- heuristica, que ganhou uma trava a mais: tipo_servico tem que bater.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS par_id UUID;

CREATE INDEX IF NOT EXISTS corridas_empresa_par_idx
  ON corridas_empresa (par_id) WHERE par_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
