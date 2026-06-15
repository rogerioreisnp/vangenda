-- Migration: adiciona colunas de rota_fixa em rotas_empresa e cria paradas_empresa
-- Executar no Supabase SQL Editor

-- Novas colunas em rotas_empresa para suportar tipo_operacao = 'rota_fixa'
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS horario_ida time;
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS horario_volta time;
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS dias_semana integer[];
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS capacidade integer;
ALTER TABLE rotas_empresa ADD COLUMN IF NOT EXISTS ativa boolean DEFAULT true;

-- Tabela de paradas para rotas de empresa (rota_fixa)
CREATE TABLE IF NOT EXISTS paradas_empresa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id     uuid NOT NULL REFERENCES rotas_empresa(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  preco       numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE paradas_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestores podem gerenciar paradas da empresa"
ON paradas_empresa
FOR ALL
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM gestores WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM gestores WHERE user_id = auth.uid()
  )
);
