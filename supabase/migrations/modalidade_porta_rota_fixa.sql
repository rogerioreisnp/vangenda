-- Modalidade de embarque/desembarque no rota fixa: buscar em casa, deixar em
-- casa, ou porta a porta — dentro de UMA unica rota.
--
-- Contexto (Alexandre / ASF Transporte, Recife — 2026-08-04):
-- Como o sistema so sabia trabalhar ponto a ponto, ele foi obrigado a criar
-- TRES rotas identicas pro mesmo trajeto e horario ("Maceio/Recife",
-- "Maceio/Recife so porta", "Maceio/Recife porta a porta") pra representar as
-- modalidades. Como a lotacao e contada por rota, a van dele de 4 lugares
-- passou a aceitar 4+4+4 = 12 reservas. Palavras dele: "eu so tenho 4, e se
-- der um estopim de passageiros e reservar 12 eu nao vou ter como levar 12".
--
-- Com a modalidade virando campo da RESERVA, ele mantem uma rota so, com uma
-- van e uma lotacao honesta.
--
-- O PRECO nao muda por causa da modalidade — continua vindo do trecho
-- (paradas_empresa). Diferenca de valor por bairro/cidade ele ja resolve
-- cadastrando paradas proprias (Olinda, Paulista, Abreu e Lima...), e isso
-- segue funcionando igual.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

-- Quais modalidades a rota oferece. Rota que so faz ponto a ponto nao mostra
-- escolha nenhuma pro passageiro — nada muda pra quem ja usa hoje.
ALTER TABLE rotas_empresa
  ADD COLUMN IF NOT EXISTS oferece_porta BOOLEAN NOT NULL DEFAULT FALSE;

-- Modalidade contratada em cada reserva.
--   'rota'        — embarca e desembarca nos pontos (padrao de hoje)
--   'buscar'      — busca na casa, deixa no ponto
--   'deixar'      — embarca no ponto, deixa na casa
--   'porta_porta' — busca e deixa na casa
ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS modalidade_embarque TEXT
    CHECK (modalidade_embarque IS NULL OR modalidade_embarque IN ('rota','buscar','deixar','porta_porta'));

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS modalidade_embarque TEXT
    CHECK (modalidade_embarque IS NULL OR modalidade_embarque IN ('rota','buscar','deixar','porta_porta'));

-- NULL = 'rota' na leitura. Nao preenchemos as linhas antigas de proposito:
-- toda reserva que existe hoje e ponto a ponto, e NULL ja significa isso.

NOTIFY pgrst, 'reload schema';
