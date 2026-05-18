-- =====================================================
-- VANGENDA - Script de criação do banco de dados
-- Execute este SQL no Supabase: SQL Editor → New Query
-- =====================================================

-- 1. MOTORISTAS (perfil do usuário)
create table motoristas (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  telefone text,
  criado_em timestamp with time zone default now()
);

-- 2. ROTAS (rota fixa do motorista)
create table rotas (
  id uuid default gen_random_uuid() primary key,
  motorista_id uuid references motoristas(id) on delete cascade not null,
  nome text not null,
  horario_ida time not null default '05:00',
  horario_volta time,
  dias_semana text[] default array['seg','ter','qua','qui','sex','sab'],
  ativa boolean default true,
  criado_em timestamp with time zone default now()
);

-- 3. PARADAS (pontos da rota em ordem)
create table paradas (
  id uuid default gen_random_uuid() primary key,
  rota_id uuid references rotas(id) on delete cascade not null,
  nome text not null,
  ordem integer not null
);

-- 4. PRECOS (tabela de preços por trecho)
create table precos (
  id uuid default gen_random_uuid() primary key,
  rota_id uuid references rotas(id) on delete cascade not null,
  parada_origem text not null,
  parada_destino text not null,
  valor numeric(10,2) not null,
  unique(rota_id, parada_origem, parada_destino)
);

-- 5. CLIENTES (passageiros cadastrados)
create table clientes (
  id uuid default gen_random_uuid() primary key,
  motorista_id uuid references motoristas(id) on delete cascade not null,
  nome text not null,
  telefone text,
  parada_origem_frequente text,
  parada_destino_frequente text,
  criado_em timestamp with time zone default now()
);

-- 6. AGENDAMENTOS (passageiros por dia)
create table agendamentos (
  id uuid default gen_random_uuid() primary key,
  rota_id uuid references rotas(id) on delete cascade not null,
  motorista_id uuid references motoristas(id) on delete cascade not null,
  cliente_id uuid references clientes(id),
  nome_passageiro text not null,
  telefone_passageiro text,
  parada_origem text not null,
  parada_destino text not null,
  data_viagem date not null,
  turno text not null check (turno in ('ida','volta')),
  valor numeric(10,2) not null,
  forma_pagamento text default 'dinheiro' check (forma_pagamento in ('dinheiro','pix','cartao','pendente')),
  status text default 'agendado' check (status in ('agendado','confirmado','cancelado')),
  observacoes text,
  criado_em timestamp with time zone default now()
);

-- 7. DESPESAS (controle financeiro)
create table despesas (
  id uuid default gen_random_uuid() primary key,
  motorista_id uuid references motoristas(id) on delete cascade not null,
  descricao text not null,
  categoria text not null check (categoria in ('combustivel','manutencao','pedagio','pneu','outros')),
  valor numeric(10,2) not null,
  data_despesa date not null,
  observacoes text,
  criado_em timestamp with time zone default now()
);

-- =====================================================
-- SEGURANÇA: Row Level Security (RLS)
-- Cada motorista só vê os próprios dados
-- =====================================================

alter table motoristas enable row level security;
alter table rotas enable row level security;
alter table paradas enable row level security;
alter table precos enable row level security;
alter table clientes enable row level security;
alter table agendamentos enable row level security;
alter table despesas enable row level security;

-- Políticas: motorista acessa apenas seus dados
create policy "motorista_proprio" on motoristas for all using (auth.uid() = id);
create policy "rota_proprio" on rotas for all using (auth.uid() = motorista_id);
create policy "parada_proprio" on paradas for all using (rota_id in (select id from rotas where motorista_id = auth.uid()));
create policy "preco_proprio" on precos for all using (rota_id in (select id from rotas where motorista_id = auth.uid()));
create policy "cliente_proprio" on clientes for all using (auth.uid() = motorista_id);
create policy "agendamento_proprio" on agendamentos for all using (auth.uid() = motorista_id);
create policy "despesa_proprio" on despesas for all using (auth.uid() = motorista_id);

-- Trigger: cria perfil do motorista automaticamente ao criar conta
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.motoristas (id, nome, telefone)
  values (new.id, new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'telefone');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
