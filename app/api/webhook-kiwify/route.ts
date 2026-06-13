import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mapeie aqui os IDs exatos dos produtos do seu painel Kiwify → tipo de plano
// Encontre em: Kiwify Dashboard → Produtos → (seu produto) → ID do produto
// Deixe vazio para depender apenas do nome do produto
const PRODUCT_ID_MAP: Record<string, 'mensal' | 'semestral' | 'anual'> = {
  // 'ID_DO_PRODUTO_MENSAL_AQUI': 'mensal',
  // 'ID_DO_PRODUTO_SEMESTRAL_AQUI': 'semestral',
  // 'ID_DO_PRODUTO_ANUAL_AQUI': 'anual',
}

function detectarPlano(nomeProduto: string, idProduto: string, chargeFrequency?: string): 'mensal' | 'semestral' | 'anual' {
  if (PRODUCT_ID_MAP[idProduto]) return PRODUCT_ID_MAP[idProduto]

  // charge_frequency é o campo oficial da Kiwify — mais confiável que inferir pelo nome
  if (chargeFrequency) {
    const freq = chargeFrequency.toLowerCase()
    if (freq === 'annual' || freq === 'yearly' || freq === 'anual') return 'anual'
    if (freq === 'semiannual' || freq === 'semestral' || freq === 'biannual') return 'semestral'
    if (freq === 'monthly' || freq === 'mensal') return 'mensal'
  }

  const nome = nomeProduto.toLowerCase()
  if (
    nome.includes('anual') || nome.includes('annual') || nome.includes('year') ||
    nome.includes('12 mes') || nome.includes('12mes') ||
    nome.includes('1 ano') || nome.includes('1ano') || nome.includes('365')
  ) {
    return 'anual'
  }
  if (
    nome.includes('semestral') || nome.includes('semestre') ||
    nome.includes('6 mes') || nome.includes('6mes') || nome.includes('6-mes')
  ) {
    return 'semestral'
  }
  return 'mensal'
}

function calcularExpiracao(tipo: 'mensal' | 'semestral' | 'anual'): Date {
  const expira = new Date()
  if (tipo === 'anual') expira.setFullYear(expira.getFullYear() + 1)
  else if (tipo === 'semestral') expira.setMonth(expira.getMonth() + 6)
  else expira.setMonth(expira.getMonth() + 1)
  return expira
}

// Busca o ID do usuário pelo email sem depender de paginação limitada
async function buscarUsuarioIdPorEmail(email: string): Promise<string | null> {
  // Tentativa 1: função SQL dedicada (escalável, sem limite de paginação)
  // Requer a migration supabase_get_user_by_email.sql executada no Supabase
  const { data: userId, error: rpcError } = await supabase
    .rpc('get_user_id_by_email', { p_email: email.toLowerCase() })

  if (!rpcError && userId) return userId as string

  // Tentativa 2 (fallback): percorre todas as páginas do listUsers
  let page = 1
  const perPage = 50
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) break
    const encontrado = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (encontrado) return encontrado.id
    if (data.users.length < perPage) break
    page++
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // O Kiwify envia o token de segurança como query parameter na URL do webhook
    // Configure a URL no painel Kiwify como:
    //   https://seu-app.vercel.app/api/webhook-kiwify?token=SEU_TOKEN
    // e coloque o mesmo valor em KIWIFY_WEBHOOK_TOKEN no Vercel
    const webhookToken = process.env.KIWIFY_WEBHOOK_TOKEN
    if (webhookToken) {
      const tokenRecebido = req.nextUrl.searchParams.get('token') ?? body?.token ?? body?.webhook_token
      if (tokenRecebido !== webhookToken) {
        console.warn('[kiwify] Requisição bloqueada: token inválido. Recebido:', tokenRecebido)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const email = (body?.Customer?.email || body?.customer?.email || '').trim().toLowerCase()
    const status = body?.order_status || body?.status || ''
    const nomeProduto = body?.Product?.name || body?.product?.name || ''
    const idProduto = body?.Product?.id || body?.product?.id || ''

    if (!email) {
      console.error('[kiwify] Payload sem email:', JSON.stringify(body))
      return NextResponse.json({ error: 'Email não encontrado no payload' }, { status: 400 })
    }

    const statusAprovados = ['paid', 'approved', 'complete', 'completed']
    if (!statusAprovados.includes(status)) {
      return NextResponse.json({ ok: true, msg: `Status ignorado: ${status}` })
    }

    const chargeFrequency = body?.Subscription?.charge_frequency || body?.subscription?.charge_frequency || ''
    const tipoPlan = detectarPlano(nomeProduto, idProduto, chargeFrequency)
    const expira = calcularExpiracao(tipoPlan)

    const userId = await buscarUsuarioIdPorEmail(email)
    if (!userId) {
      console.error(`[kiwify] Usuário não encontrado para email: ${email}`)
      return NextResponse.json({ error: `Usuário não encontrado: ${email}` }, { status: 404 })
    }

    const { error } = await supabase
      .from('motoristas')
      .update({
        assinatura_status: 'ativo',
        assinatura_expira: expira.toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error(`[kiwify] Erro ao ativar motorista ${userId}:`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[kiwify] Acesso liberado | email: ${email} | plano: ${tipoPlan} | expira: ${expira.toISOString()}`)
    return NextResponse.json({ ok: true, msg: `Acesso liberado para ${email}` })

  } catch (err) {
    console.error('[kiwify] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
