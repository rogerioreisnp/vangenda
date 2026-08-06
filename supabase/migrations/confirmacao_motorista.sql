-- Confirmacao de recebimento pelo motorista (transfer).
--
-- Contexto (Alexandre de Curitiba, via Rogerio — 2026-08-06): o gestor
-- atribui a corrida, o push sai, e ele nao tem como saber se chegou. Hoje
-- so descobre ligando.
--
-- Optamos por NAO usar recibo de entrega do servico de push, de proposito:
--   1. "Entregue no celular" nao e "o motorista viu" — a notificacao pode
--      ficar na bandeja sem ninguem abrir.
--   2. Dependeria de um servico externo devolver a informacao certa.
--
-- Em vez disso, a confirmacao vem do proprio motorista, dentro do app:
--   motorista_visto_em      — carimbado sozinho quando ele ABRE a ficha
--   motorista_confirmado_em — quando ele TOCA em "confirmar que recebi"
--
-- Os dois juntos contam a historia completa pro gestor: "abriu as 13:58 mas
-- nao confirmou" e um sinal diferente de "nem abriu". Nos dois casos ele
-- sabe que precisa ligar — que e o que ele queria.
--
-- Importante: os dois campos sao ZERADOS quando o gestor troca o motorista
-- da corrida (feito no codigo). Confirmacao do motorista antigo nao vale
-- pro novo.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS motorista_visto_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motorista_confirmado_em TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
