import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { userId, nomeEmpresa, nomeGestor, email, telefone, tipoOperacao, afid } = await req.json()

    // `plano` deixou de ser exigido no cadastro (2026-08-05): quem entra pelo
    // "iniciar teste gratis" nao escolhe plano nenhum, so testa. O que a
    // pessoa contrata de fato — o periodo (mensal/semestral/anual) — e
    // gravado na coluna `periodo` pelo webhook do Kiwify quando ela paga.
    if (!userId || !nomeEmpresa || !nomeGestor || !email) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const telLimpo = (telefone ?? '').replace(/\D/g, '')
    if (telLimpo.length < 10) {
      return NextResponse.json({ error: 'Telefone obrigatório (mínimo 10 dígitos com DDD)' }, { status: 400 })
    }

    const trialFim = new Date()
    trialFim.setDate(trialFim.getDate() + 10)

    const { data: empresa, error: errEmpresa } = await supabaseAdmin
      .from('empresas')
      .insert({
        nome:          nomeEmpresa,
        email:         email,
        telefone:      telefone,
        tipo_operacao: tipoOperacao,
        // Coluna legada de "nivel" de plano (starter/pro/fleet), de quando os
        // planos tinham recursos diferentes. Hoje todos tem os mesmos recursos
        // — o que varia e so o periodo. Gravamos o nome do produto pra nao
        // deixar um rotulo antigo que nao existe mais.
        plano:         'empresarial',
        status:        'trial',
        trial_inicio:  new Date().toISOString(),
        trial_fim:     trialFim.toISOString().split('T')[0],
        // Código de afiliado da Kiwify (?afid= no link de cadastro) — usado
        // depois pra montar o link de pagamento na tela de trial encerrado.
        // Ver supabase/migrations/afiliados_kiwify.sql.
        afid:          afid || null,
      })
      .select('id')
      .single()

    if (errEmpresa) throw errEmpresa

    const { error: errGestor } = await supabaseAdmin
      .from('gestores')
      .insert({
        user_id:    userId,
        empresa_id: empresa.id,
        nome:       nomeGestor,
        email:      email,
      })

    if (errGestor) throw errGestor

    return NextResponse.json({ success: true, empresaId: empresa.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao criar empresa' }, { status: 500 })
  }
}
