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

    // Eventos que ATIVAM/RENOVAM acesso (compra aprovada + renovação recorrente).
    // Cobre variações porque a Kiwify não documenta 100% os nomes técnicos.
    const eventosAtivam = [
      'order_approved', 'paid', 'approved', 'complete', 'completed',
      'subscription_renewed', 'subscription_renewal', 'renewal_approved',
      'subscription_charged', 'subscription_charge_paid', 'charge_recurring_paid',
    ]
    // Eventos que DESATIVAM acesso (cancelamento, atraso, reembolso, chargeback).
    // "Atraso" cobre o caso do cartão não passar — sistema já bloqueia até quitar.
    const eventosDesativam = [
      'subscription_canceled', 'subscription_cancelled',
      'subscription_late', 'subscription_overdue',
      'order_refunded', 'refunded', 'chargeback',
    ]

    if (!eventosAtivam.includes(eventType) && !eventosDesativam.includes(eventType)) {
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
      // Cliente pagou com email diferente do cadastro (ou ainda não cadastrou).
      // Guarda o pagamento em `pagamentos_orfaos` pra não perder + notifica o
      // admin por email pra resolver manualmente (linkar ao user_id correto).
      // Case real: Girassol tour, 2026-07-19.
      console.warn(`[kiwify] Órfão — email não cadastrado: ${email} | plano: ${planoParam} | expira: ${expira}`)

      const valorPago = Number(order?.Commissions?.charge_amount ?? order?.CheckoutValueByCurrency?.value ?? order?.total_amount ?? 0) / 100
      const kiwifyOrderId = order?.order_id ?? order?.id ?? null

      const { error: errOrfao } = await supabase.from('pagamentos_orfaos').insert({
        email_pagamento: email,
        valor: isFinite(valorPago) && valorPago > 0 ? valorPago : null,
        plano_nome: planName || nomeProduto || null,
        periodo,
        expira_em: expira,
        kiwify_order_id: kiwifyOrderId,
        payload_completo: body,
      })
      if (errOrfao) console.error('[kiwify] Erro ao salvar órfão:', errOrfao.message)

      // Notifica admin por email — reaproveita Resend que já está configurado.
      const adminEmail = process.env.ADMIN_EMAIL || 'rogerioreisguitar@gmail.com'
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const htmlAdmin = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <h2 style="color:#A32D2D;margin:0 0 12px 0;">⚠️ Pagamento órfão — Kiwify</h2>
  <p style="color:#374151;">Um cliente pagou mas o email não bate com nenhum cadastro no app. Precisa ativar manualmente.</p>
  <div style="background:#FEF2F2;border-left:4px solid #A32D2D;padding:16px;border-radius:8px;margin:16px 0;">
    <p style="margin:0 0 6px 0;"><strong>Email do pagamento:</strong> ${email}</p>
    <p style="margin:0 0 6px 0;"><strong>Plano:</strong> ${planName || nomeProduto || '—'}</p>
    <p style="margin:0 0 6px 0;"><strong>Período:</strong> ${periodo}</p>
    <p style="margin:0 0 6px 0;"><strong>Expira em:</strong> ${expira}</p>
    <p style="margin:0;"><strong>Kiwify Order ID:</strong> ${kiwifyOrderId ?? '—'}</p>
  </div>
  <p style="color:#6B7280;font-size:13px;">Como resolver: descubra o email real do cliente no app, e rode um UPDATE em <code>motoristas</code> ou <code>empresas</code> conforme o plano. Depois marque <code>resolvido = true</code> na tabela <code>pagamentos_orfaos</code>.</p>
</div>`
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Rotagenda Alertas <alertas@rotagenda.com.br>',
              to: [adminEmail],
              subject: `⚠️ Pagamento órfão Kiwify: ${email}`,
              html: htmlAdmin,
            }),
          })
        } catch (e) {
          console.error('[kiwify] Falha ao enviar email admin:', e)
        }
      }

      return NextResponse.json({ ok: true, msg: `Pagamento órfão registrado: ${email}` })
    }

    const userId = usuario.id
    console.log(`[kiwify] Usuário encontrado: ${userId}`)

    // DESATIVAÇÃO — cancelamento, atraso, reembolso ou chargeback.
    // Setar status 'inativo' bloqueia acesso imediato (tanto em motoristas
    // quanto em empresas o gate lê status/assinatura_status pra decidir).
    if (eventosDesativam.includes(eventType)) {
      console.log(`[kiwify] Desativando acesso — motivo: ${eventType}`)
      const { data: gestorDes } = await supabase
        .from('gestores')
        .select('empresa_id')
        .eq('user_id', userId)
        .single()

      if (gestorDes?.empresa_id) {
        const { error: errEmpDes } = await supabase
          .from('empresas')
          .update({ status: 'inativo' })
          .eq('id', gestorDes.empresa_id)
        if (errEmpDes) console.error('[kiwify] Erro desativar empresa:', errEmpDes.message)
        console.log(`[kiwify] Empresa desativada | empresa_id: ${gestorDes.empresa_id}`)
      } else {
        // Individual: mantém assinatura_expira pra preservar histórico, muda só status.
        const { error: errMotDes } = await supabase
          .from('motoristas')
          .update({ assinatura_status: 'inativo' })
          .eq('id', userId)
        if (errMotDes) console.error('[kiwify] Erro desativar motorista:', errMotDes.message)
        console.log(`[kiwify] Motorista desativado | user_id: ${userId}`)
      }
      return NextResponse.json({ ok: true, msg: `Acesso desativado: ${email} (motivo: ${eventType})` })
    }

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

    const empresaId = gestor?.empresa_id ?? null

    if (planoParam === 'empresarial' || empresaId) {
      console.log(`[kiwify] Atualizando empresa: ${empresaId}`)
      const { error: errEmpresa } = await supabase
        .from('empresas')
        .update({
          status: 'ativo',
          trial_fim: expira,
          periodo,
        })
        .eq('id', empresaId)

      if (errEmpresa) {
        console.error('[kiwify] Erro ao atualizar empresa:', errEmpresa.message)
        return NextResponse.json({ error: errEmpresa.message }, { status: 500 })
      }

      console.log(`[kiwify] Empresa ativada | empresa_id: ${empresaId} | expira: ${expira}`)
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
