import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
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

    const { nome, email, senha, telefone, veiculo, placa } = await req.json()

    if (!nome?.trim() || !email?.trim() || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const { data: authData, error: errUser } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: senha,
      email_confirm: true,
    })
    if (errUser) {
      const jaExiste = errUser.message.toLowerCase().includes('already')
      if (jaExiste) {
        return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 })
      }
      throw errUser
    }

    const motoristaId = authData.user.id

    // Cria registro em motoristas para que /dashboard funcione (Etapa 2 refina o acesso empresa)
    const { error: errMot } = await supabaseAdmin
      .from('motoristas')
      .insert({
        id: motoristaId,
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        assinatura_status: 'ativo',
        assinatura_expira: '2099-12-31T23:59:59Z',
      })

    if (errMot) {
      await supabaseAdmin.auth.admin.deleteUser(motoristaId)
      throw errMot
    }

    const { error: errMotEmp } = await supabaseAdmin
      .from('motoristas_empresa')
      .insert({
        empresa_id: gestor.empresa_id,
        user_id: motoristaId,
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        veiculo: veiculo?.trim() || null,
        placa: placa?.trim() || null,
        status: 'ativo',
      })

    if (errMotEmp) {
      await supabaseAdmin.auth.admin.deleteUser(motoristaId)
      throw errMotEmp
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao criar motorista' },
      { status: 500 }
    )
  }
}
