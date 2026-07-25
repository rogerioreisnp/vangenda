-- Migration: modulo de Clientes (PJ + PF) do transfer empresarial — Fase 2.
--
-- NOME: `clientes_empresa` — segue o padrao das outras tabelas empresariais
-- (motoristas_empresa, corridas_empresa, despesas_empresa, cobrancas_empresa,
-- rotas_empresa). Nao pode ser so `clientes` porque ja existe uma tabela
-- `clientes` no app INDIVIDUAL (motorista_id, parada_origem_frequente etc).
--
-- Contexto: hoje as corridas_empresa tem cliente_nome/cliente_telefone
-- como campos livres. Julimar quer poder CADASTRAR clientes recorrentes
-- (hoteis, agencias, PJs — mas tambem PFs frequentes) e:
--   1. Vincular atendimento ao cliente (dropdown com autocomplete)
--   2. No fim do mes, filtrar atendimentos por cliente + gerar relatorio
--      consolidado (PDF+Excel) pra cobrar
--   3. Dados fiscais do cliente aparecem no cabecalho dos recibos
--
-- IMPORTANTE: nao removemos cliente_nome/cliente_telefone das corridas.
-- Cliente cadastrado e OPCIONAL — atendimentos avulsos continuam
-- funcionando com nome livre. cliente_id nullable via ON DELETE SET NULL.
--
-- Sem login pra cliente (decisao Julimar). Cliente = registro de dados.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

CREATE TABLE IF NOT EXISTS clientes_empresa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL CHECK (tipo IN ('pj', 'pf')),

  -- PJ: usa razao_social + nome_fantasia + cnpj + inscricao_estadual
  -- PF: usa nome + cpf
  -- Todos NULLABLE — a UI valida conforme o tipo
  razao_social      TEXT,
  nome_fantasia     TEXT,
  cnpj              TEXT,
  inscricao_estadual TEXT,
  nome              TEXT,
  cpf               TEXT,

  -- Contato (ambos os tipos)
  telefone          TEXT,
  email             TEXT,
  contato_nome      TEXT,   -- pessoa de contato dentro do PJ (opcional)

  -- Endereco (ambos os tipos, opcional)
  endereco_rua      TEXT,
  endereco_numero   TEXT,
  endereco_bairro   TEXT,
  endereco_cidade   TEXT,
  endereco_estado   TEXT,
  endereco_cep      TEXT,

  observacoes       TEXT,
  ativo             BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clientes_empresa_empresa_idx ON clientes_empresa (empresa_id);
CREATE INDEX IF NOT EXISTS clientes_empresa_ativo_idx ON clientes_empresa (empresa_id, ativo) WHERE ativo;
-- Busca por nome/razao — mais util pro autocomplete
CREATE INDEX IF NOT EXISTS clientes_empresa_busca_idx ON clientes_empresa (empresa_id, tipo, razao_social, nome_fantasia, nome);

-- RLS: gestor da empresa pode tudo, funcionario motorista pode ler
-- (pra ver cliente nos atendimentos que ele executa).
-- IMPORTANTE: qualificamos TODAS as colunas com alias pra evitar ambiguidade.
ALTER TABLE clientes_empresa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes_empresa' AND policyname = 'gestor_gerencia_clientes_empresa') THEN
    CREATE POLICY "gestor_gerencia_clientes_empresa" ON clientes_empresa
      FOR ALL TO authenticated
      USING (clientes_empresa.empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()))
      WITH CHECK (clientes_empresa.empresa_id IN (SELECT g.empresa_id FROM gestores g WHERE g.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes_empresa' AND policyname = 'funcionario_le_clientes_empresa') THEN
    CREATE POLICY "funcionario_le_clientes_empresa" ON clientes_empresa
      FOR SELECT TO authenticated
      USING (clientes_empresa.empresa_id IN (SELECT empresas_do_motorista_logado()));
  END IF;
END $$;

-- FK opcional em corridas_empresa
ALTER TABLE corridas_empresa
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS corridas_empresa_cliente_idx ON corridas_empresa (cliente_id) WHERE cliente_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
