-- Rodar no Supabase Dashboard > SQL Editor
create table if not exists encomendas (
  id uuid default gen_random_uuid() primary key,
  motorista_id uuid references motoristas(id),
  nome text not null,
  telefone text,
  valor numeric not null default 0,
  observacao text,
  pago boolean default false,
  valor_pago numeric default 0,
  forma_pagamento text,
  data_combinada date,
  criado_em timestamp with time zone default now()
);

-- RLS: motorista só vê suas próprias encomendas
alter table encomendas enable row level security;

create policy "motorista vê suas encomendas" on encomendas
  for all using (auth.uid() = motorista_id);
