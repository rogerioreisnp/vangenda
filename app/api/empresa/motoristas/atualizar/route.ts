import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const { data: gestor } = await supabaseAdmin
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()

    if (!gestor) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { motoristaEmpresaId, novoEmail, novaSenha } = await req.json()

    if (!motoristaEmpresaId) {
      return NextResponse.json({ error: 'ID do motorista é obrigatório' }, { status: 400 })
    }

    const { data: mot } = await supabaseAdmin
      .from('motoristas_empresa')
      .select('user_id')
      .eq('id', motoristaEmpresaId)
      .eq('empresa_id', gestor.empresa_id)
      .single()

    if (!mot?.user_id) {
      return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 })
    }

    const updates: { email?: string; password?: string } = {}

    if (novoEmail?.trim()) {
      updates.email = novoEmail.trim().toLowerCase()
    }
    if (novaSenha) {
      if (novaSenha.length < 6) {
        return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })
      }
      updates.password = novaSenha
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      mot.user_id,
      updates
    )

    if (updateError) {
      const msg = updateError.message.toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 })
      }
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao atualizar motorista' }, { status: 500 })
  }
}
