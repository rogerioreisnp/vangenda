import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Kiwify envia o email do comprador
    const email = body?.Customer?.email || body?.customer?.email || ''
    const status = body?.order_status || body?.status || ''
    const plano = body?.Product?.name || body?.product?.name || ''

    if (!email) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })
    }

    // Só processa pagamentos aprovados
    if (status !== 'paid' && status !== 'approved' && status !== 'complete') {
      return NextResponse.json({ ok: true, msg: 'Status ignorado: ' + status })
    }

    // Calcular data de expiração baseado no plano
    const agora = new Date()
    let expira = new Date()

    const nomePlano = plano.toLowerCase()
    if (nomePlano.includes('anual')) {
      expira.setFullYear(agora.getFullYear() + 1)
    } else if (nomePlano.includes('semestral')) {
      expira.setMonth(agora.getMonth() + 6)
    } else {
      // Mensal (padrão)
      expira.setMonth(agora.getMonth() + 1)
    }

    // Buscar motorista pelo email
    const { data: usuario } = await supabase.auth.admin.listUsers()
    const user = usuario?.users?.find(u => u.email === email)

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado: ' + email }, { status: 404 })
    }

    // Atualizar status do motorista
    const { error } = await supabase
      .from('motoristas')
      .update({
        assinatura_status: 'ativo',
        assinatura_expira: expira.toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, msg: 'Acesso liberado para ' + email })

  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
