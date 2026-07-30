import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron diario de alertas pro GESTOR (transfer). Roda 1x por dia.
 *
 * Dois alertas (pedido de clientes via Rogerio, 2026-07-30):
 *   Item 3 — pagamentos que vencem HOJE: lembra o gestor de dar baixa
 *   Item 4 — pagamentos VENCIDOS: avisa que continua sem receber
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
  const hoje = new Date().toISOString().slice(0, 10)
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

  // Resolve gestores das empresas envolvidas (1 query pra todas)
  const empresaIds = Array.from(new Set([
    ...(vencemHoje || []).map(c => c.empresa_id),
    ...(vencidas || []).map(c => c.empresa_id),
  ]))
  if (empresaIds.length === 0) {
    return NextResponse.json({ ok: true, vencem_hoje: 0, vencidas: 0, msg: 'Nada a notificar' })
  }

  const { data: gestores } = await supabase
    .from('gestores')
    .select('user_id, empresa_id')
    .in('empresa_id', empresaIds)

  const gestorPorEmpresa: Record<string, string> = {}
  ;(gestores || []).forEach(g => {
    if (g.empresa_id && g.user_id && !gestorPorEmpresa[g.empresa_id]) {
      gestorPorEmpresa[g.empresa_id] = g.user_id
    }
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

  console.log('[cron-notificacoes]', {
    vencem_hoje: idsAlertaPagamento.length,
    vencidas: idsAlertaAtraso.length,
    empresas: Object.keys(gestorPorEmpresa).length,
  })

  return NextResponse.json({
    ok: true,
    vencem_hoje: idsAlertaPagamento.length,
    vencidas: idsAlertaAtraso.length,
    detalhes: resultados,
  })
}
