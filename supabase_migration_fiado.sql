-- Migration: módulo Fiado
-- Execute no Supabase: SQL Editor → New Query

alter table agendamentos add column if not exists fiado_pago boolean default false;
alter table agendamentos add column if not exists fiado_valor_pago numeric default 0;
alter table agendamentos add column if not exists fiado_forma_pagamento text;
alter table agendamentos add column if not exists fiado_data_combinada date;
