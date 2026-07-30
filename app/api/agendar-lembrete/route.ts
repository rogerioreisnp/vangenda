import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dataHoraBrasilia } from '@/lib/data-hora'

/**
 * Agenda (ou reagenda/cancela) o lembrete pre-atendimento no OneSignal.
 * Item 1 da lista de notificacoes pedida por clientes via Rogerio.
 *
 * Chamado sempre que um atendimento e criado ou editado. Fluxo:
 *   1. Cancela o lembrete anterior, se existir (gestor pode ter mudado
 *      o horario ou trocado o motorista — o push antigo avisaria errado)
 *   2. Reagenda com o novo horario, se ainda fizer sentido
 *   3. Guarda o novo ID em corridas_empresa.onesignal_lembrete_id
 *
 * Usa send_after do OneSignal (entrega programada nativa) em vez de cron
 * de minuto em minuto — mais preciso e sem custo de infraestrutura.
 *
 * NAO agenda quando:
 *   - Atendimento cancelado ou ja concluido
 *   - Sem motorista atribuido (nao ha quem avisar)
 *   - O horario do lembrete ja passou (ex: atendimento criado 20 min antes
 *     de comecar, com lembrete configurado pra 60 min — nao adianta)
 */

export const dynamic = 'force-dynamic'

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications'

async function cancelarLembrete(notificationId: string, appId: string, apiKey: string) {
  try {
    await fetch(`${ONESIGNAL_URL}/${notificationId}?app_id=${appId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Key ${apiKey}` },
    })
  } catch (e) {
    // Cancelamento e best-effort: se a notificacao ja foi entregue ou
    // nao existe mais, o DELETE falha e tudo bem — seguimos pro reagendamento.
    console.warn('[agendar-lembrete] falha ao cancelar', notificationId, e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { corrida_id } = await req.json()
    if (!corrida_id) {
      return NextResponse.json({ error: 'corrida_id obrigatório' }, { status: 400 })
    }

    const appId = process.env.ONESIGNAL_APP_ID
    const apiKey = process.env.ONESIGNAL_API_KEY
    if (!appId || !apiKey) {
      return NextResponse.json({ ok: true, skipped: 'OneSignal não configurado' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: c } = await supabase
      .from('corridas_empresa')
      .select('id, empresa_id, motorista_id, data_hora, origem, destino, status, onesignal_lembrete_id, numero_reserva')
      .eq('id', corrida_id)
      .maybeSingle()

    if (!c) return NextResponse.json({ ok: true, skipped: 'Atendimento não encontrado' })

    // 1. Cancela lembrete anterior (horario/motorista podem ter mudado)
    if (c.onesignal_lembrete_id) {
      await cancelarLembrete(c.onesignal_lembrete_id, appId, apiKey)
      await supabase.from('corridas_empresa')
        .update({ onesignal_lembrete_id: null })
        .eq('id', c.id)
    }

    // 2. Decide se reagenda
    if (c.status === 'cancelada' || c.status === 'concluida') {
      return NextResponse.json({ ok: true, agendado: false, motivo: `status ${c.status}` })
    }
    if (!c.motorista_id) {
      return NextResponse.json({ ok: true, agendado: false, motivo: 'sem motorista atribuído' })
    }

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome, minutos_antes_lembrete')
      .eq('id', c.empresa_id)
      .maybeSingle()

    const minutos = empresa?.minutos_antes_lembrete ?? 60
    if (minutos <= 0) {
      return NextResponse.json({ ok: true, agendado: false, motivo: 'lembrete desativado na empresa' })
    }

    const inicio = dataHoraBrasilia(c.data_hora)
    const quandoAvisar = new Date(inicio.getTime() - minutos * 60 * 1000)
    if (quandoAvisar.getTime() <= Date.now()) {
      return NextResponse.json({ ok: true, agendado: false, motivo: 'horário do lembrete já passou' })
    }

    // 3. Descobre o user_id do motorista (tag do OneSignal)
    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('user_id, nome')
      .eq('id', c.motorista_id)
      .maybeSingle()

    if (!motEmp?.user_id) {
      return NextResponse.json({ ok: true, agendado: false, motivo: 'motorista sem login' })
    }

    const primeiroNome = (motEmp.nome || '').split(' ')[0] || 'motorista'
    const hora = c.data_hora.slice(11, 16)
    const num = c.numero_reserva ? `#${c.numero_reserva}` : ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vangenda.vercel.app'

    const horasLabel = minutos >= 60 && minutos % 60 === 0
      ? `${minutos / 60}h`
      : `${minutos} min`

    const resp = await fetch(ONESIGNAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
      body: JSON.stringify({
        app_id: appId,
        filters: [{ field: 'tag', key: 'motorista_id', relation: '=', value: motEmp.user_id }],
        headings: { pt: `⏰ ${primeiroNome}, atendimento em ${horasLabel}`, en: 'Upcoming ride' },
        contents: {
          pt: `${hora} · ${c.origem} → ${c.destino} ${num}`.trim(),
          en: `${hora} · ${c.origem} → ${c.destino}`,
        },
        url: `${appUrl}/motorista/corrida/${c.id}`,
        send_after: quandoAvisar.toISOString(),
      }),
    })

    const data = await resp.json()

    if (data?.id) {
      await supabase.from('corridas_empresa')
        .update({ onesignal_lembrete_id: data.id })
        .eq('id', c.id)
    }

    console.log('[agendar-lembrete]', {
      corrida_id: c.id,
      envia_em: quandoAvisar.toISOString(),
      minutos_antes: minutos,
      onesignal_id: data?.id ?? null,
      erro: data?.errors ?? null,
    })

    return NextResponse.json({
      ok: true,
      agendado: !!data?.id,
      envia_em: quandoAvisar.toISOString(),
      onesignal: data,
    })
  } catch (err) {
    console.error('[agendar-lembrete] erro interno:', err)
    // Falha silenciosa pro client: lembrete e conveniencia, nao pode
    // travar o salvamento do atendimento.
    return NextResponse.json({ ok: true, agendado: false, motivo: 'erro interno' })
  }
}
