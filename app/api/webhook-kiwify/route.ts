import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'Webhook Kiwify ativo' })
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await req.json()
    console.log('[kiwify] Payload recebido:', JSON.stringify(body))

    // Validar token
    const webhookToken = process.env.KIWIFY_WEBHOOK_TOKEN
    if (webhookToken) {
      const tokenRecebido = req.nextUrl.searchParams.get('token') ?? body?.token
      if (tokenRecebido !== webhookToken) {
        console.warn('[kiwify] Token inválido. Recebido:', tokenRecebido)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extrair dados do payload real da Kiwify
    const order = body?.order ?? body
    const eventType = order?.webhook_event_type ?? order?.order_status ?? ''
    const email = (order?.Customer?.email ?? '').trim().toLowerCase()
    const nomeProduto = (order?.Product?.product_name ?? order?.Product?.name ?? '').toLowerCase()
    const planName = (order?.Subscription?.plan?.name ?? '').toLowerCase()
    const accessUntil = order?.Subscription?.customer_access?.access_until ?? null

    console.log(`[kiwify] event: ${eventType} | email: ${email} | produto: ${nomeProduto} | plano: ${planName} | expira: ${accessUntil}`)

    // Só processar compras aprovadas
    const eventosAprovados = ['order_approved', 'paid', 'approved', 'complete', 'completed']
    if (!eventosAprovados.includes(eventType)) {
      console.log(`[kiwify] Evento ignorado: ${eventType}`)
      return NextResponse.json({ ok: true, msg: `Evento ignorado: ${eventType}` })
    }

    if (!email) {
      console.error('[kiwify] Email não encontrado no payload')
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })
    }

    // Calcular expiração: usa access_until da Kiwify se disponível, senão calcula
    let expira: string
    if (accessUntil) {
      expira = accessUntil
    } else {
      const d = new Date()
      if (planName.includes('anual') || planName.includes('annual')) d.setFullYear(d.getFullYear() + 1)
      else if (planName.includes('semestral') || planName.includes('semes')) d.setMonth(d.getMonth() + 6)
      else d.setMonth(d.getMonth() + 1)
      expira = d.toISOString()
    }

    // Determinar período para salvar
    let periodo = 'mensal'
    if (planName.includes('anual') || planName.includes('annual')) periodo = 'anual'
    else if (planName.includes('semestral') || planName.includes('semes')) periodo = 'semestral'

    // Parâmetro ?plano= na URL define explicitamente qual produto é
    const planoParam = req.nextUrl.searchParams.get('plano') ?? '' // 'individual' ou 'empresarial'
    console.log(`[kiwify] plano param URL: ${planoParam}`)

    // Buscar usuário no Auth pelo email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (userError) {
      console.error('[kiwify] Erro ao listar usuários:', userError.message)
      return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }

    const usuario = userData?.users?.find(u => u.email?.toLowerCase() === email)
    if (!usuario) {
      console.error(`[kiwify] Usuário não encontrado para email: ${email}`)
      return NextResponse.json({ error: `Usuário não encontrado: ${email}` }, { status: 404 })
    }

    const userId = usuario.id
    console.log(`[kiwify] Usuário encontrado: ${userId}`)

    // Se URL tem ?plano=individual, vai direto para motoristas
    if (planoParam === 'individual') {
      console.log(`[kiwify] Forçando atualização individual por parâmetro URL`)
      const { error: errMotorista } = await supabase
        .from('motoristas')
        .update({ assinatura_status: 'ativo', assinatura_expira: expira })
        .eq('id', userId)

      if (errMotorista) {
        console.error('[kiwify] Erro ao atualizar motorista:', errMotorista.message)
        return NextResponse.json({ error: errMotorista.message }, { status: 500 })
      }

      console.log(`[kiwify] Motorista ativado | user_id: ${userId} | expira: ${expira}`)
      return NextResponse.json({ ok: true, msg: `Acesso individual liberado: ${email}` })
    }

    // Tentar atualizar tabela empresas (plano empresarial) via gestores
    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', userId)
      .single()

    if (planoParam === 'empresarial' || gestor?.empresa_id) {
      console.log(`[kiwify] Atualizando empresa: ${gestor.empresa_id}`)
      const { error: errEmpresa } = await supabase
        .from('empresas')
        .update({
          status: 'ativo',
          trial_fim: expira,
          periodo,
        })
        .eq('id', gestor.empresa_id)

      if (errEmpresa) {
        console.error('[kiwify] Erro ao atualizar empresa:', errEmpresa.message)
        return NextResponse.json({ error: errEmpresa.message }, { status: 500 })
      }

      console.log(`[kiwify] Empresa ativada | empresa_id: ${gestor.empresa_id} | expira: ${expira}`)
      return NextResponse.json({ ok: true, msg: `Empresa ativada: ${email}` })
    }

    // Fallback: atualizar tabela motoristas (plano individual)
    console.log(`[kiwify] Atualizando motorista individual: ${userId}`)
    const { error: errMotorista } = await supabase
      .from('motoristas')
      .update({
        assinatura_status: 'ativo',
        assinatura_expira: expira,
      })
      .eq('id', userId)

    if (errMotorista) {
      console.error('[kiwify] Erro ao atualizar motorista:', errMotorista.message)
      return NextResponse.json({ error: errMotorista.message }, { status: 500 })
    }

    console.log(`[kiwify] Motorista ativado | user_id: ${userId} | expira: ${expira}`)
    return NextResponse.json({ ok: true, msg: `Acesso liberado: ${email}` })

  } catch (err) {
    console.error('[kiwify] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
