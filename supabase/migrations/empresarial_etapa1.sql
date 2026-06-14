-- Tabela de empresas
CREATE TABLE empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  tipo_operacao TEXT NOT NULL DEFAULT 'rota_fixa',
  plano TEXT NOT NULL DEFAULT 'starter',
  periodo TEXT NOT NULL DEFAULT 'mensal',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_inicio TIMESTAMPTZ DEFAULT NOW(),
  trial_fim TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de gestores (dono da empresa)
CREATE TABLE gestores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de motoristas vinculados a empresas
CREATE TABLE motoristas_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  veiculo TEXT,
  placa TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de rotas da empresa (origem → destino com preço)
CREATE TABLE rotas_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  distancia_km INTEGER,
  preco DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de corridas agendadas
CREATE TABLE corridas_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES motoristas_empresa(id) ON DELETE SET NULL,
  rota_id UUID REFERENCES rotas_empresa(id) ON DELETE SET NULL,
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  valor DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmada',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de checklist por motorista e data
CREATE TABLE checklist_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES motoristas_empresa(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  pneus BOOLEAN DEFAULT false,
  freios BOOLEAN DEFAULT false,
  luzes BOOLEAN DEFAULT false,
  combustivel BOOLEAN DEFAULT false,
  documentos BOOLEAN DEFAULT false,
  limpeza BOOLEAN DEFAULT false,
  ar_condicionado BOOLEAN DEFAULT false,
  extintor BOOLEAN DEFAULT false,
  aprovado BOOLEAN DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cobranças
CREATE TABLE cobrancas_empresa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES motoristas_empresa(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  vencimento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: habilitar em todas as tabelas novas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestores ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE corridas_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas_empresa ENABLE ROW LEVEL SECURITY;

-- RLS Policies: gestor só enxerga dados da própria empresa
CREATE POLICY "gestor_ve_propria_empresa" ON empresas
  FOR ALL USING (
    id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );

CREATE POLICY "gestor_ve_proprios_dados" ON gestores
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "gestor_ve_motoristas" ON motoristas_empresa
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );

CREATE POLICY "gestor_ve_rotas" ON rotas_empresa
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );

CREATE POLICY "gestor_ve_corridas" ON corridas_empresa
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );

CREATE POLICY "gestor_ve_checklist" ON checklist_empresa
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );

CREATE POLICY "gestor_ve_cobrancas" ON cobrancas_empresa
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM gestores WHERE user_id = auth.uid())
  );
