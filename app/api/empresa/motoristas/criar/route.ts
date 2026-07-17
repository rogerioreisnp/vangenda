import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  let motoristaId: string | null = null

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

    const { nome, email, senha, telefone, veiculo, placa, cor, veiculos } = await req.json()

    // `veiculos` (array) é o formato novo (múltiplos veículos). Se não vier,
    // cai pro formato antigo (veiculo/placa/cor únicos) por compatibilidade.
    const listaVeiculos: { veiculo?: string; placa?: string; cor?: string }[] =
      Array.isArray(veiculos) && veiculos.length > 0
        ? veiculos
        : (veiculo || placa || cor) ? [{ veiculo, placa, cor }] : []

    if (!nome?.trim() || !email?.trim() || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()
    console.log('[criar-motorista] Iniciando para email:', emailNorm)

    // ── Passo 1: criar usuário no Auth ──────────────────────────────────────
    const { data: authData, error: errUser } = await supabaseAdmin.auth.admin.createUser({
      email: emailNorm,
      password: senha,
      email_confirm: true,
      user_metadata: {
        tipo: 'motorista_empresa',
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
      },
    })

    if (errUser) {
      console.error('[criar-motorista] Erro ao criar auth user:', errUser.message)
      const msg = errUser.message.toLowerCase()
      // GoTrue retorna mensagens variadas para email duplicado ou constraint violation
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        msg.includes('database error creating new user') ||
        (errUser as any).status === 422
      ) {
        return NextResponse.json({ error: 'Este e-mail já está em uso' }, { status: 400 })
      }
      throw errUser
    }

    if (!authData?.user) {
      console.error('[criar-motorista] createUser retornou sem user e sem erro')
      return NextResponse.json({ error: 'Erro inesperado ao criar usuário' }, { status: 500 })
    }

    motoristaId = authData.user.id
    console.log('[criar-motorista] Auth user criado, id:', motoristaId)

    // ── Passo 2: upsert em motoristas ────────────────────────────────────────
    // Usa upsert porque pode existir um trigger no banco que já criou o registro
    // automaticamente ao inserir em auth.users (padrão do app individual).
    const { error: errMot } = await supabaseAdmin
      .from('motoristas')
      .upsert(
        {
          id: motoristaId,
          nome: nome.trim(),
          telefone: telefone?.trim() || null,
          assinatura_status: 'ativo',
          assinatura_expira: '2099-12-31T23:59:59Z',
        },
        { onConflict: 'id' }
      )

    if (errMot) {
      console.error('[criar-motorista] Erro no upsert motoristas:', errMot.message)
      await rollback(supabaseAdmin, motoristaId, false)
      throw errMot
    }

    console.log('[criar-motorista] Upsert motoristas OK')

    // ── Passo 3: inserir em motoristas_empresa ────────────────────────────────
    // Colunas legadas veiculo/placa/cor guardam o "veículo principal" (o
    // primeiro da lista) — mantém compatibilidade com todo lugar que ainda
    // lê essas colunas direto (mensagem de WhatsApp, tela do motorista).
    const principal = listaVeiculos[0]
    const { data: motEmpCriado, error: errMotEmp } = await supabaseAdmin
      .from('motoristas_empresa')
      .insert({
        empresa_id: gestor.empresa_id,
        user_id: motoristaId,
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        veiculo: principal?.veiculo?.trim() || null,
        placa: principal?.placa?.trim() || null,
        cor: principal?.cor?.trim() || null,
        status: 'ativo',
      })
      .select('id')
      .single()

    if (errMotEmp) {
      console.error('[criar-motorista] Erro no insert motoristas_empresa:', errMotEmp.message)
      await rollback(supabaseAdmin, motoristaId, true)
      throw errMotEmp
    }

    // ── Passo 4: inserir todos os veículos em veiculos_motorista ──────────────
    if (listaVeiculos.length > 0 && motEmpCriado) {
      const registros = listaVeiculos
        .filter(v => v.veiculo?.trim() || v.placa?.trim() || v.cor?.trim())
        .map((v, i) => ({
          motorista_empresa_id: motEmpCriado.id,
          veiculo: v.veiculo?.trim() || null,
          placa: v.placa?.trim() || null,
          cor: v.cor?.trim() || null,
          ordem: i,
        }))
      if (registros.length > 0) {
        const { error: errVeiculos } = await supabaseAdmin.from('veiculos_motorista').insert(registros)
        if (errVeiculos) {
          // Não faz rollback total por causa disso — motorista e veículo
          // principal já foram criados com sucesso. Só loga o problema.
          console.error('[criar-motorista] Erro ao inserir veiculos_motorista:', errVeiculos.message)
        }
      }
    }

    console.log('[criar-motorista] Concluído com sucesso para:', emailNorm)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    // Se chegou aqui sem rollback ter sido chamado, ainda temos motoristaId no escopo
    // (ex: erro inesperado antes dos passos acima). Não fazemos rollback cego aqui
    // pois os blocos acima já chamam rollback com informação contextual.
    return NextResponse.json(
      { error: err.message || 'Erro ao criar motorista' },
      { status: 500 }
    )
  }
}

async function rollback(supabaseAdmin: any, motoristaId: string, deletarMotoristas: boolean) {
  console.log('[criar-motorista] Iniciando rollback para id:', motoristaId)
  if (deletarMotoristas) {
    const { error } = await supabaseAdmin.from('motoristas').delete().eq('id', motoristaId)
    if (error) console.error('[criar-motorista] Rollback motoristas falhou:', error.message)
    else console.log('[criar-motorista] Rollback: registro motoristas removido')
  }
  const { error } = await (supabaseAdmin.auth as any).admin.deleteUser(motoristaId)
  if (error) console.error('[criar-motorista] Rollback auth user falhou:', error.message)
  else console.log('[criar-motorista] Rollback: auth user removido')
}
