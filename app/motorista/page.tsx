'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type CorridaRes = {
  id: string
  origem: string | null
  destino: string | null
  data_hora: string
  cliente_nome: string | null
  passageiro1_nome: string | null
  status: string
  tipo_servico: string | null
  data_hora_termino: string | null
}

const TIPO_LABEL: Record<string, string> = {
  transfer: 'Transfer',
  diaria: 'Diária',
  city_tour: 'City tour',
  fretamento: 'Fretamento',
  excursao: 'Excursão',
}

export default function MotoristaHome() {
  const [nome, setNome] = useState('')
  const [motEmpresaId, setMotEmpresaId] = useState<string | null>(null)
  const [hoje, setHoje] = useState<CorridaRes[]>([])
  const [amanha, setAmanha] = useState<CorridaRes[]>([])
  const [proxima, setProxima] = useState<CorridaRes | null>(null)
  const [emAndamento, setEmAndamento] = useState<CorridaRes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('id, nome')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!motEmp) { setLoading(false); return }

    setMotEmpresaId(motEmp.id)
    setNome(motEmp.nome || '')

    const agora = new Date()
    const hojeStr = format(agora, 'yyyy-MM-dd')
    const amanhaStr = format(addDays(agora, 1), 'yyyy-MM-dd')

    const cols = 'id, origem, destino, data_hora, cliente_nome, passageiro1_nome, status, tipo_servico, data_hora_termino'

    const [{ data: dHoje }, { data: dAmanha }, { data: dProxima }, { data: dAndamento }] = await Promise.all([
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .gte('data_hora', `${hojeStr}T00:00:00`)
        .lte('data_hora', `${hojeStr}T23:59:59`)
        .neq('status', 'cancelada')
        .order('data_hora', { ascending: true }),
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .gte('data_hora', `${amanhaStr}T00:00:00`)
        .lte('data_hora', `${amanhaStr}T23:59:59`)
        .neq('status', 'cancelada')
        .order('data_hora', { ascending: true }),
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .gte('data_hora', agora.toISOString())
        .in('status', ['confirmada', 'pendente'])
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .eq('status', 'em_andamento')
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    setHoje((dHoje || []) as CorridaRes[])
    setAmanha((dAmanha || []) as CorridaRes[])
    setProxima((dProxima as CorridaRes | null) || null)
    setEmAndamento((dAndamento as CorridaRes | null) || null)
    setLoading(false)
  }

  const horaAgora = new Date().getHours()
  const saudacao = horaAgora < 12 ? 'Bom dia' : horaAgora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="pb-4">
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-6">
        <p style={{ color: '#9FE1CB' }} className="text-xs">{saudacao},</p>
        <p style={{ color: '#E1F5EE' }} className="text-xl font-bold leading-tight">
          {nome ? nome.split(' ')[0] : '...'}
        </p>
        <p style={{ color: '#9FE1CB' }} className="text-xs mt-0.5 capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {emAndamento && (
          <Link href={`/motorista/corrida/${emAndamento.id}`}
            className="rounded-2xl p-4 border-2 active:opacity-75"
            style={{ background: '#E1F5EE', borderColor: '#0F6E56' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>🟢 EM ANDAMENTO</p>
            <p className="text-base font-bold text-gray-800 mt-1">
              {emAndamento.origem} → {emAndamento.destino || '...'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              👤 {passageiro(emAndamento)}
            </p>
            <p className="text-xs mt-2 font-semibold" style={{ color: '#0F6E56' }}>
              Toque para abrir a ficha →
            </p>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <CardContador
            emoji="📅"
            label="Corridas hoje"
            valor={hoje.length}
          />
          <CardContador
            emoji="📆"
            label="Corridas amanhã"
            valor={amanha.length}
          />
        </div>

        {proxima && !emAndamento && (
          <Link href={`/motorista/corrida/${proxima.id}`}
            className="rounded-2xl p-4 bg-white border border-gray-100 active:opacity-75"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0F6E56' }}>Próxima corrida</p>
            <p className="text-base font-bold text-gray-800 mt-1">
              {proxima.origem} → {proxima.destino || '...'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              🕐 {formatarDataHora(proxima.data_hora)}
            </p>
            <p className="text-sm text-gray-600">
              👤 {passageiro(proxima)}
            </p>
            {proxima.tipo_servico && (
              <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#F0FDF4', color: '#166534' }}>
                {TIPO_LABEL[proxima.tipo_servico] || proxima.tipo_servico}
              </span>
            )}
          </Link>
        )}

        <ListaResumo titulo="🕐 Hoje" items={hoje} />

        {amanha.length > 0 && <ListaResumo titulo="📆 Amanhã" items={amanha} />}

        {!loading && hoje.length === 0 && amanha.length === 0 && !proxima && !emAndamento && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">😴</p>
            <p className="text-sm font-bold text-gray-800">Nenhuma corrida atribuída</p>
            <p className="text-xs text-gray-500 mt-1">
              Quando o gestor te atribuir uma corrida, ela aparece aqui e você recebe uma notificação.
            </p>
          </div>
        )}

        <Link href="/motorista/agenda"
          className="rounded-2xl p-3 bg-white border border-gray-100 text-center active:opacity-75">
          <p className="text-sm font-semibold" style={{ color: '#0F6E56' }}>Ver agenda completa →</p>
        </Link>
      </div>
    </div>
  )
}

function CardContador({ emoji, label, valor }: { emoji: string; label: string; valor: number }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="text-2xl font-bold text-gray-800">{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{label}</p>
    </div>
  )
}

function ListaResumo({ titulo, items }: { titulo: string; items: CorridaRes[] }) {
  if (items.length === 0) return null
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
      {items.map(c => (
        <Link key={c.id} href={`/motorista/corrida/${c.id}`}
          className="rounded-xl px-3 py-2 flex items-center justify-between gap-2 border border-gray-100 active:opacity-75"
          style={{ background: '#f9fafb' }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">
              {formatarHora(c.data_hora)} · {c.origem || '—'} → {c.destino || '—'}
            </p>
            <p className="text-xs text-gray-500 truncate">👤 {passageiro(c)}</p>
          </div>
          <span className="text-gray-300 text-xl flex-shrink-0">›</span>
        </Link>
      ))}
    </div>
  )
}

// Sem passageiro informado, NAO mostra o nome do solicitante. O solicitante
// costuma ser o cliente comercial da empresa (agencia de turismo, hotel), e
// expor isso pro motorista permitiria ele fechar direto e passar por cima da
// empresa. Decisao do Rogerio, 2026-08-12: "tem coisa que e sigilosa".
function passageiro(c: CorridaRes): string {
  return c.passageiro1_nome || 'Passageiro a confirmar'
}

function formatarDataHora(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} às ${iso.slice(11, 16)}`
}

function formatarHora(iso: string): string {
  return iso.slice(11, 16)
}
