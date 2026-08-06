-- Carro fechado no rota fixa — ETAPA 1 (configuracao na rota).
--
-- Contexto (Alexandre e Emanuela / ASF Transporte, Recife — 2026-08-06):
-- alem da rota compartilhada, eles vendem o veiculo INTEIRO pro cliente
-- ("carro fechado"). Palavras da Emanuela: "nao so fretamento, mas
-- fretamento de carro fechado e solicitacao de carro compartilhado em
-- outro horario para uma pre reserva".
--
-- Carro fechado e sempre VEICULO A PARTE — nunca a van da grade. Rogerio,
-- confirmando com eles: "se e um carro fechado, com certeza vai ser outro
-- veiculo... voce vai pegar o carro fechado e vai tirar todos os seus
-- clientes da sua rota? Isso ai e uma reserva extra". Ou seja: NAO consome
-- vaga de saida nenhuma, nao aparece na contagem de lotacao, nao encosta em
-- horarios_rota. Por isso tem preco proprio, separado do preco por trecho.
--
-- O preco muda conforme a quantidade de lugares (confirmado pelo Alexandre:
-- "dependendo da quantidade de vagas o valor muda"). A frota deles e de
-- veiculos de 4 e 6 lugares. Guardamos como FAIXAS em JSONB em vez de duas
-- colunas fixas — no dia que entrar um carro de 7 lugares, ou que eles
-- quiserem cobrar diferente pra 2 pessoas, resolvem na propria tela, sem
-- precisar de migration nova.
--
-- Formato de precos_carro_fechado:
--   [{"lugares": 4, "preco": 350.00}, {"lugares": 6, "preco": 500.00}]
-- Leitura: menor faixa cujo "lugares" comporta o grupo. Grupo maior que a
-- maior faixa fica sem preco — vira solicitacao pro gestor cotar na mao.
--
-- Acrescimo por parada adicional ficou de fora de proposito: a transcricao
-- do audio era ambigua nesse ponto e o Rogerio preferiu comecar so com o
-- valor do carro fechado ("depois se eles precisarem nos ajustamos").
--
-- NADA muda pra quem ja usa: oferece_carro_fechado nasce FALSE, entao o
-- link publico de todas as rotas existentes continua identico.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE rotas_empresa
  ADD COLUMN IF NOT EXISTS oferece_carro_fechado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS precos_carro_fechado JSONB;

NOTIFY pgrst, 'reload schema';
