import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { userId, nomeEmpresa, nomeGestor, email, telefone, tipoOperacao, plano } = await req.json()

    if (!userId || !nomeEmpresa || !nomeGestor || !email || !plano) {
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
        plano,
        status:        'trial',
        trial_inicio:  new Date().toISOString(),
        trial_fim:     trialFim.toISOString().split('T')[0],
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
