-- Migration: módulo Fiado
-- Execute no Supabase: SQL Editor → New Query

-- 1. Colunas novas
alter table agendamentos add column if not exists fiado_pago boolean default false;
alter table agendamentos add column if not exists fiado_valor_pago numeric default 0;
alter table agendamentos add column if not exists fiado_forma_pagamento text;
alter table agendamentos add column if not exists fiado_data_combinada date;

-- 2. Colunas de observação e mensagem personalizada
alter table agendamentos add column if not exists fiado_observacao text;
alter table motoristas add column if not exists mensagem_fiado_whatsapp text;

-- 3. Remover constraint antiga e recriar incluindo 'fiado'
--    (o CHECK antigo bloqueava silenciosamente qualquer insert com forma_pagamento='fiado')
alter table agendamentos drop constraint if exists agendamentos_forma_pagamento_check;
alter table agendamentos add constraint agendamentos_forma_pagamento_check
  check (forma_pagamento in ('dinheiro','pix','cartao','pendente','fiado'));
