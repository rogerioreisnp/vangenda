-- Veiculo atribuido a UMA corrida especifica (transfer) — pedido do
-- Julimar, 2026-08-05: cliente as vezes exige um veiculo especifico (ex:
-- "precisa ser numa van"). O gestor ja atribui o motorista direto na
-- ficha; agora, quando esse motorista tem mais de um veiculo cadastrado
-- (ate 5, veiculos_motorista), o gestor tambem escolhe QUAL veiculo vai
-- ser usado NAQUELE atendimento.
--
-- Guardado como snapshot de texto (nao FK pra veiculos_motorista) de
-- proposito: se o gestor editar/apagar o veiculo depois, o historico da
-- corrida ja feita continua intacto — mesmo padrao usado pros enderecos
-- e outros dados da corrida.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS veiculo_atribuido TEXT;

NOTIFY pgrst, 'reload schema';
