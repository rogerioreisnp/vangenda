-- Migration: cidade por parada + cidade_origem/destino por rota (individual).
--
-- Contexto: rota bilateral entre 2 cidades (ex: Piripiri <-> Teresina). Hoje
-- as paradas nao tem cidade, entao o form publico mostra todas as paradas em
-- ambos os dropdowns (embarque e desembarque), o que confunde o passageiro:
-- ele pode escolher "Ida" + "embarca em Teresina" + "desembarca em Piripiri",
-- que e o oposto do que a rota faz naquele horario. Case: Francisco (PI).
--
-- Solucao 100% retrocompativel: colunas nullable. Se o motorista nao
-- preencher, o app continua exatamente como hoje. Quando preencher, o form
-- publico filtra os dropdowns por cidade + mostra cabecalho tipo
-- "Ida: Piripiri -> Teresina (05:00h)" pra deixar a direcao evidente.
--
-- Escopo: apenas motorista individual (tabelas `rotas` e `paradas`). Nao
-- toca em `rotas_empresa` — rota_fixa empresarial fica pra segunda etapa
-- depois de validarmos no individual.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE rotas
  ADD COLUMN IF NOT EXISTS cidade_origem  TEXT,
  ADD COLUMN IF NOT EXISTS cidade_destino TEXT;

ALTER TABLE paradas
  ADD COLUMN IF NOT EXISTS cidade TEXT;

NOTIFY pgrst, 'reload schema';
