import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron diario de alertas pro GESTOR (transfer). Roda 1x por dia.
 *
 * Tres alertas:
 *   Item 3 — pagamentos que vencem HOJE (so Faturado): lembra o gestor de dar baixa
 *   Item 4 — pagamentos VENCIDOS (so Faturado): avisa que continua sem receber
 *   Item 5 — Pix/Dinheiro/Cartao ainda pendentes X horas apos o atendimento
 *            (pedido Rogerio 2026-08-01): esses nao tem "data de vencimento"
 *            como o Faturado — sao esperados no proprio dia. Se o motorista
 *            nao repassar pro gestor ou o cliente nao pagar, ninguem era
 *            avisado. X e configuravel por empresa (empresas.
 *            horas_apos_atendimento_cobranca, default 24h, 0 = desativado).
 *            Dispara UMA vez so (marca alerta_pagamento_imediato_enviado_em).
 *
 * Decisoes de design:
 *   - AGRUPA por empresa: gestor com 5 pagamentos vencendo recebe UMA
 *     notificacao resumida ("5 pagamentos vencem hoje · R$ 3.200"), nao
 *     5 pushes seguidos. Toque leva direto pro financeiro.
 *   - MARCA cada corrida como alertada (alerta_pagamento_enviado_em /
 *     alerta_atraso_enviado_em) pra nao repetir o mesmo aviso amanha.
 *   - Alerta vai so pro gestor (tag motorista_id = user_id do gestor,
 *     mesmo esquema ja usado pelo OneSignalInit no layout do empresarial).
 *     Motorista nao recebe aviso de cobranca de cliente.
 *   - Protegido por CRON_SECRET (mesmo padrao do webhook Kiwify). Sem o
 *     token, retorna 401 — evita que qualquer um dispare os alertas.
 *
 * Agendamento: chamado por cron externo (cron-job.org) ou Vercel Cron,
 * 1x/dia de manha. Como sao verificacoes diarias, frequencia baixa basta
 * — nao exige plano pago.
 */

// GET handlers sao candidatos a prerender estatico no build do Next. Como
// essa rota depende de env vars do Supabase (ausentes/placeholder em build),
// forcamos execucao dinamica — so roda quando o cron chama de verdade.
export const dynamic = 'force-dynamic'

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications'

type CorridaAlerta = {
  id: string
  empresa_id: string
  cliente_nome: string | null
  valor: number | null
  valor_recebido: number | null
  data_prevista_pagamento: string | null
  data_hora?: string
  forma_pagamento?: string | null
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function enviarPush(gestorUserId: string, titulo: string, corpo: string, url: string) {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_API_KEY
  if (!appId || !apiKey) return { skipped: 'OneSignal não configurado' }

  const resp = await fetch(ONESIGNAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
    body: JSON.stringify({
      app_id: appId,
      filters: [{ field: 'tag', key: 'motorista_id', relation: '=', value: gestorUserId }],
      headings: { pt: titulo, en: titulo },
      contents: { pt: corpo, en: corpo },
      url,
    }),
  })
  return await resp.json()
}

export async function GET(req: NextRequest) {
  // Auth: aceita ?token= na query (cron-job.org) ou header Authorization
  // Bearer (Vercel Cron manda assim).
  const secret = process.env.CRON_SECRET
  if (secret) {
    const tokenQuery = req.nextUrl.searchParams.get('token')
    const authHeader = req.headers.get('authorization')
    const tokenHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (tokenQuery !== secret && tokenHeader !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'
  const agoraDate = new Date()
  const hoje = agoraDate.toISOString().slice(0, 10)
  const cols = 'id, empresa_id, cliente_nome, valor, valor_recebido, data_prevista_pagamento'

  // ── Item 3: vencem HOJE e ainda nao foram alertadas ──────────────────
  const { data: vencemHoje } = await supabase
    .from('corridas_empresa')
    .select(cols)
    .eq('data_prevista_pagamento', hoje)
    .neq('status_pagamento', 'recebido')
    .neq('status', 'cancelada')
    .is('alerta_pagamento_enviado_em', null)
    .limit(500)

  // ── Item 4: JA VENCERAM e ainda nao foram alertadas de atraso ────────
  const { data: vencidas } = await supabase
    .from('corridas_empresa')
    .select(cols)
    .lt('data_prevista_pagamento', hoje)
    .neq('status_pagamento', 'recebido')
    .neq('status', 'cancelada')
    .is('alerta_atraso_enviado_em', null)
    .limit(500)

  // ── Item 5: Pix/Dinheiro/Cartao pendentes ha mais de X horas ─────────
  // Sem data de vencimento (diferente do Faturado) — a referencia e a
  // propria data_hora do atendimento. Janela de 45 dias pra tras evita
  // varrer o historico inteiro toda vez; corridas mais antigas que isso
  // ja deveriam ter sido resolvidas ou canceladas manualmente.
  const janela45dias = new Date(agoraDate.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const { data: pendentesImediato } = await supabase
    .from('corridas_empresa')
    .select(`${cols}, data_hora, forma_pagamento`)
    .in('forma_pagamento', ['pix', 'dinheiro', 'cartao'])
    .neq('status_pagamento', 'recebido')
    .neq('status', 'cancelada')
    .lt('data_hora', agoraDate.toISOString())
    .gte('data_hora', janela45dias)
    .is('alerta_pagamento_imediato_enviado_em', null)
    .limit(500)

  // Resolve gestores das empresas envolvidas (1 query pra todas)
  const empresaIds = Array.from(new Set([
    ...(vencemHoje || []).map(c => c.empresa_id),
    ...(vencidas || []).map(c => c.empresa_id),
    ...(pendentesImediato || []).map((c: any) => c.empresa_id),
  ]))
  if (empresaIds.length === 0) {
    return NextResponse.json({ ok: true, vencem_hoje: 0, vencidas: 0, pendentes_imediato: 0, msg: 'Nada a notificar' })
  }

  const [{ data: gestores }, { data: empresasConfig }] = await Promise.all([
    supabase.from('gestores').select('user_id, empresa_id').in('empresa_id', empresaIds),
    supabase.from('empresas').select('id, horas_apos_atendimento_cobranca').in('id', empresaIds),
  ])

  const gestorPorEmpresa: Record<string, string> = {}
  ;(gestores || []).forEach(g => {
    if (g.empresa_id && g.user_id && !gestorPorEmpresa[g.empresa_id]) {
      gestorPorEmpresa[g.empresa_id] = g.user_id
    }
  })

  const horasPorEmpresa: Record<string, number> = {}
  ;(empresasConfig || []).forEach((e: any) => {
    horasPorEmpresa[e.id] = e.horas_apos_atendimento_cobranca ?? 24
  })

  // Filtra so quem ja passou do prazo configurado da propria empresa
  // (0 = alerta desativado pra essa empresa).
  const pendentesFiltrados = (pendentesImediato || []).filter((c: any) => {
    const horas = horasPorEmpresa[c.empresa_id] ?? 24
    if (horas <= 0) return false
    const limiteMs = new Date(c.data_hora).getTime() + horas * 60 * 60 * 1000
    return limiteMs <= agoraDate.getTime()
  })

  // Agrupa corridas por empresa — uma notificacao resumida por gestor
  function agrupar(lista: CorridaAlerta[] | null): Record<string, CorridaAlerta[]> {
    const mapa: Record<string, CorridaAlerta[]> = {}
    ;(lista || []).forEach(c => {
      if (!mapa[c.empresa_id]) mapa[c.empresa_id] = []
      mapa[c.empresa_id].push(c)
    })
    return mapa
  }

  const saldo = (c: CorridaAlerta) => Number(c.valor || 0) - Number(c.valor_recebido || 0)

  const resultados: any[] = []
  const idsAlertaPagamento: string[] = []
  const idsAlertaAtraso: string[] = []

  // Dispara item 3
  for (const [empresaId, lista] of Object.entries(agrupar(vencemHoje as CorridaAlerta[]))) {
    const gestorUserId = gestorPorEmpresa[empresaId]
    if (!gestorUserId) continue
    const total = lista.reduce((s, c) => s + saldo(c), 0)
    const titulo = lista.length === 1
      ? '💰 Pagamento vence hoje'
      : `💰 ${lista.length} pagamentos vencem hoje`
    const corpo = lista.length === 1
      ? `${lista[0].cliente_nome || 'Cliente'} · R$ ${fmtBRL(total)} — confirme se já recebeu.`
      : `Total de R$ ${fmtBRL(total)} a receber hoje. Toque para revisar e dar baixa.`
    const r = await enviarPush(gestorUserId, titulo, corpo, `${appUrl}/empresa/financeiro`)
    resultados.push({ tipo: 'vence_hoje', empresaId, qtd: lista.length, onesignal: r })
    idsAlertaPagamento.push(...lista.map(c => c.id))
  }

  // Dispara item 4
  for (const [empresaId, lista] of Object.entries(agrupar(vencidas as CorridaAlerta[]))) {
    const gestorUserId = gestorPorEmpresa[empresaId]
    if (!gestorUserId) continue
    const total = lista.reduce((s, c) => s + saldo(c), 0)
    const titulo = lista.length === 1
      ? '⚠️ Pagamento em atraso'
      : `⚠️ ${lista.length} pagamentos em atraso`
    const corpo = lista.length === 1
      ? `${lista[0].cliente_nome || 'Cliente'} · R$ ${fmtBRL(total)} venceu e ainda não foi recebido.`
      : `Total de R$ ${fmtBRL(total)} vencido e não recebido. Toque para revisar.`
    const r = await enviarPush(gestorUserId, titulo, corpo, `${appUrl}/empresa/financeiro`)
    resultados.push({ tipo: 'atraso', empresaId, qtd: lista.length, onesignal: r })
    idsAlertaAtraso.push(...lista.map(c => c.id))
  }

  // Dispara item 5 — dispara so 1x (marca alerta_pagamento_imediato_enviado_em)
  const idsAlertaImediato: string[] = []
  const FORMA_LABEL: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }
  for (const [empresaId, lista] of Object.entries(agrupar(pendentesFiltrados as CorridaAlerta[]))) {
    const gestorUserId = gestorPorEmpresa[empresaId]
    if (!gestorUserId) continue
    const total = lista.reduce((s, c) => s + saldo(c), 0)
    const horas = horasPorEmpresa[empresaId] ?? 24
    const formaLabel = FORMA_LABEL[(lista[0] as any).forma_pagamento] || 'Pagamento'
    const titulo = lista.length === 1
      ? `💰 ${formaLabel} pendente há ${horas}h+`
      : `💰 ${lista.length} pagamentos pendentes há ${horas}h+`
    const corpo = lista.length === 1
      ? `${lista[0].cliente_nome || 'Cliente'} · R$ ${fmtBRL(total)} — confirme se o motorista já repassou ou dê baixa.`
      : `Total de R$ ${fmtBRL(total)} sem confirmação de recebimento. Toque para revisar.`
    const r = await enviarPush(gestorUserId, titulo, corpo, `${appUrl}/empresa/financeiro`)
    resultados.push({ tipo: 'pendente_imediato', empresaId, qtd: lista.length, onesignal: r })
    idsAlertaImediato.push(...lista.map(c => c.id))
  }

  // Marca como alertadas — evita repetir o mesmo aviso amanha
  const agora = new Date().toISOString()
  if (idsAlertaPagamento.length > 0) {
    await supabase.from('corridas_empresa')
      .update({ alerta_pagamento_enviado_em: agora })
      .in('id', idsAlertaPagamento)
  }
  if (idsAlertaAtraso.length > 0) {
    await supabase.from('corridas_empresa')
      .update({ alerta_atraso_enviado_em: agora })
      .in('id', idsAlertaAtraso)
  }
  if (idsAlertaImediato.length > 0) {
    await supabase.from('corridas_empresa')
      .update({ alerta_pagamento_imediato_enviado_em: agora })
      .in('id', idsAlertaImediato)
  }

  console.log('[cron-notificacoes]', {
    vencem_hoje: idsAlertaPagamento.length,
    vencidas: idsAlertaAtraso.length,
    pendentes_imediato: idsAlertaImediato.length,
    empresas: Object.keys(gestorPorEmpresa).length,
  })

  return NextResponse.json({
    ok: true,
    vencem_hoje: idsAlertaPagamento.length,
    vencidas: idsAlertaAtraso.length,
    pendentes_imediato: idsAlertaImediato.length,
    detalhes: resultados,
  })
}
