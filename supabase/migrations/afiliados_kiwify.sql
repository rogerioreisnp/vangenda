-- Migration: rastreamento de afiliado (afid da Kiwify) ponta a ponta.
--
-- Contexto: o Julimar indicou o RotaGenda pro "seu Ivan" usando o link de
-- afiliado dele. Ivan se cadastrou (trial gratis, sem cartao), usou o app
-- por uns dias, e so pagou DEPOIS clicando no botao "Assinar" — que aponta
-- pra um link fixo da Kiwify (https://pay.kiwify.com.br/xxxx), igual pra
-- todo mundo, sem nenhuma marca de quem indicou. A Kiwify so consegue
-- atribuir comissao a um afiliado se o parametro `afid` estiver presente
-- na URL de checkout NO MOMENTO da compra — como o cadastro acontece no
-- nosso site, nao no da Kiwify, esse parametro se perdia e a comissao
-- inteira caia pra conta do produtor (Rogerio), 2026-08-16.
--
-- Fix: capturar o `afid` da URL no PRIMEIRO acesso (cadastro), guardar
-- junto com a conta, e usa-lo pra montar o link de pagamento dinamicamente
-- (append `?afid=<codigo>`) sempre que o botao Assinar for exibido —
-- não importa se a pessoa paga no dia 1 do trial ou 60 dias depois.
--
-- Cada afiliado pega o proprio codigo `afid` no painel de afiliados da
-- Kiwify e passa a divulgar `https://[dominio]/?afid=SEUCODIGO` (individual)
-- ou `https://[dominio]/empresa/registro?afid=SEUCODIGO` (empresarial) em
-- vez do link direto de pagamento.
--
-- Idempotente. Execute no SQL Editor do Vangenda.

ALTER TABLE empresas   ADD COLUMN IF NOT EXISTS afid TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS afid TEXT;

-- Atualiza o trigger de criação de motorista individual pra também gravar
-- o afid vindo do metadata do cadastro (auth.signUp options.data.afid).
-- Mantém 100% do comportamento anterior — só adiciona a coluna nova.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Gestores de empresa usam a tabela gestores, não motoristas
  IF NEW.raw_user_meta_data->>'tipo' = 'gestor' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.motoristas (id, nome, telefone, trial_inicio, assinatura_status, assinatura_expira, afid)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'telefone',
    NOW(),
    'trial',
    NOW() + INTERVAL '10 days',
    NEW.raw_user_meta_data->>'afid'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
