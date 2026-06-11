# 🚐 RotaGenda

Sistema de agendamento para motoristas de van intermunicipal.

---

## 📋 O que o sistema faz

- ✅ Agendamento de passageiros por data futura
- ✅ Calendário interativo com visão de todos os dias
- ✅ Tabela de preços automática por trecho
- ✅ Controle financeiro (receitas e despesas)
- ✅ Alerta de passageiros para o dia seguinte
- ✅ Confirmação de passageiros
- ✅ Funciona no celular como app (PWA)

---

## 🚀 Como colocar no ar (passo a passo)

### PASSO 1 — Criar conta no Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **"New Project"**
3. Escolha um nome (ex: `vangenda`) e uma senha forte
4. Aguarde criar (1-2 minutos)
5. Vá em **Settings → API**
6. Copie:
   - **Project URL** (começa com `https://...supabase.co`)
   - **anon public key** (chave longa)

### PASSO 2 — Criar as tabelas no banco

1. No Supabase, clique em **SQL Editor → New Query**
2. Abra o arquivo `supabase_schema.sql` deste projeto
3. Cole todo o conteúdo lá e clique em **Run**
4. Aguarde a mensagem de sucesso ✅

### PASSO 3 — Subir o código na Vercel

1. Crie uma conta em [github.com](https://github.com) (se não tiver)
2. Crie um repositório novo chamado `vangenda`
3. Faça upload de todos os arquivos desta pasta
4. Acesse [vercel.com](https://vercel.com) e crie uma conta
5. Clique em **"Add New Project"**
6. Conecte com o repositório `vangenda` do GitHub
7. Antes de clicar em Deploy, adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL` → Cole a URL do Passo 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Cole a chave do Passo 1
8. Clique em **Deploy** e aguarde ✅

### PASSO 4 — Acessar o sistema

Após o deploy, você receberá um link tipo:
```
https://vangenda.vercel.app
```

Abra no celular, crie sua conta de motorista e comece a usar!

---

## 📱 Instalar como app no celular

**Android (Chrome):**
1. Abra o link no Chrome
2. Toque no menu (⋮)
3. Toque em **"Adicionar à tela inicial"**

**iPhone (Safari):**
1. Abra o link no Safari
2. Toque no botão de compartilhar (□↑)
3. Toque em **"Adicionar à Tela de Início"**

---

## 💰 Modelo de cobrança sugerido

Você pode cobrar dos motoristas uma assinatura mensal.
Para configurar pagamentos automáticos, recomendamos:
- **MercadoPago** (recorrência em Reais)
- **Stripe** (mais completo, aceita PIX)

---

## 🛠 Tecnologias usadas

| Tecnologia | Para que serve |
|-----------|---------------|
| Next.js 14 | Frontend e rotas da aplicação |
| React | Interface do usuário |
| Supabase | Banco de dados e autenticação |
| Tailwind CSS | Estilização |
| Vercel | Hospedagem gratuita |

---

## 📞 Suporte

Dúvidas sobre instalação? Entre em contato.
