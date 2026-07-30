import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Fase B do autocomplete de clientes recorrentes — link publico
 * (/transfer/[slug]). Diferente do form interno (Fase A, dropdown/datalist
 * direto no client), aqui quem digita e ANONIMO. Se a busca fosse por nome
 * via RLS anon direto no Supabase, um visitante poderia "pescar" nomes e
 * telefones de outros clientes da empresa digitando letra por letra —
 * vazamento de dados serio (enumeration attack).
 *
 * Por isso essa busca:
 *   1. Roda so no SERVIDOR (service_role, nunca exposto ao client)
 *   2. Exige o TELEFONE COMPLETO como chave (nao busca por nome parcial)
 *   3. Nao existe endpoint PostgREST publico pra tabela — so essa rota
 *      controlada, que so devolve nome/origem/destino do atendimento mais
 *      recente. Nao devolve email, endereco completo, CPF/CNPJ ou qualquer
 *      outro dado sensivel do cliente.
 *
 * Quem ja sabe o telefone exato de alguem (o proprio dono do numero, ou
 * quem ja tem essa informacao) e o unico que consegue "desbloquear" o
 * autopreenchimento — nao da pra escanear a base.
 */
export async function POST(req: NextRequest) {
  try {
    const { slug, telefone } = await req.json()
    if (!slug || !telefone) {
      return NextResponse.json({ error: 'slug e telefone são obrigatórios' }, { status: 400 })
    }

    const digitos = String(telefone).replace(/\D/g, '')
    // Exige telefone completo (DDD + numero, minimo 10 digitos) — numero
    // parcial nao dispara busca, evita tentativas de forca bruta incremental.
    if (digitos.length < 10) {
      return NextResponse.json({ ok: true, encontrado: false })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('slug', slug)
      .eq('tipo_operacao', 'transfer')
      .maybeSingle()

    if (!empresa) {
      return NextResponse.json({ ok: true, encontrado: false })
    }

    // Busca o atendimento mais recente dessa empresa com esse telefone.
    // Compara so digitos (cliente_telefone pode ter sido salvo com mascara
    // diferente em atendimentos antigos).
    const { data: corridas } = await supabase
      .from('corridas_empresa')
      .select('cliente_nome, cliente_telefone, origem, destino')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const match = (corridas || []).find(c =>
      (c.cliente_telefone || '').replace(/\D/g, '') === digitos
    )

    if (!match) {
      return NextResponse.json({ ok: true, encontrado: false })
    }

    return NextResponse.json({
      ok: true,
      encontrado: true,
      nome: match.cliente_nome || null,
      origem: match.origem || null,
      destino: match.destino || null,
    })
  } catch (err) {
    console.error('[buscar-cliente]', err)
    return NextResponse.json({ ok: true, encontrado: false })
  }
}
