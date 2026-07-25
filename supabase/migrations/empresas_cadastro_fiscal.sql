-- Migration: cadastro fiscal completo da empresa.
--
-- Contexto: precisamos desses dados pra sair nos vouchers/recibos que serao
-- enviados aos clientes PJ do Julimar. Sem endereco estruturado + IE + dados
-- bancarios completos, o documento fica incompleto e nao parece profissional.
--
-- Coluna `cnpj`, `logo_url`, `nome`, `descricao`, `cidade`, `estado`,
-- `email_comercial`, `whatsapp_comercial`, `instagram`, `telefone`,
-- `chave_pix`, `tipo_chave_pix`, `slug` — todas ja existem, nao mexemos.
--
-- Todos os novos campos sao NULLABLE. Empresas atuais nao quebram e podem
-- preencher aos poucos. Vouchers renderizam so o que estiver preenchido.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS endereco_rua           TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero        TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro        TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep           TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual     TEXT,
  ADD COLUMN IF NOT EXISTS site                   TEXT,
  ADD COLUMN IF NOT EXISTS banco_nome             TEXT,
  ADD COLUMN IF NOT EXISTS banco_agencia          TEXT,
  ADD COLUMN IF NOT EXISTS banco_conta            TEXT,
  ADD COLUMN IF NOT EXISTS banco_tipo_conta       TEXT,
  ADD COLUMN IF NOT EXISTS banco_titular_nome     TEXT,
  ADD COLUMN IF NOT EXISTS banco_titular_documento TEXT;

NOTIFY pgrst, 'reload schema';
