'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Corrida = {
  id: string
  origem: string | null
  destino: string | null
  data_hora: string
  data_hora_termino: string | null
  cliente_nome: string | null
  passageiro1_nome: string | null
  status: string
  tipo_servico: string | null
}

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  pendente:      { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
  confirmada:    { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:  { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:     { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:     { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
}

const TIPO_META: Record<string, { bg: string; text: string; label: string }> = {
  transfer:  { bg: '#FEE2E2', text: '#991B1B', label: 'Transfer' },
  diaria:    { bg: '#FFEDD5', text: '#9A3412', label: 'Diária' },
  city_tour: { bg: '#F0FDF4', text: '#166534', label: 'City Tour' },
  fretamento:{ bg: '#F3E8FF', text: '#6B21A8', label: 'Fretamento' },
  excursao:  { bg: '#FFF7ED', text: '#7C2D12', label: 'Excursão' },
}

type Filtro = 'proximas' | 'hoje' | 'em_andamento' | 'concluidas' | 'todas'

export default function MotoristaAgenda() {
  const [corridas, setCorridas] = useState<Corrida[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('proximas')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!motEmp) { setLoading(false); return }

    const cols = 'id, origem, destino, data_hora, data_hora_termino, cliente_nome, passageiro1_nome, status, tipo_servico'
    const agoraISO = new Date().toISOString()

    // 3 blocos ordenados: em_andamento no topo, futuras asc, passadas desc
    const [{ data: emAnd }, { data: futuras }, { data: passadas }] = await Promise.all([
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .eq('status', 'em_andamento')
        .order('data_hora', { ascending: true })
        .limit(50),
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .neq('status', 'em_andamento')
        .gte('data_hora', agoraISO)
        .order('data_hora', { ascending: true })
        .limit(150),
      supabase.from('corridas_empresa').select(cols)
        .eq('motorista_id', motEmp.id)
        .neq('status', 'em_andamento')
        .lt('data_hora', agoraISO)
        .order('data_hora', { ascending: false })
        .limit(100),
    ])

    setCorridas([...(emAnd || []), ...(futuras || []), ...(passadas || [])] as Corrida[])
    setLoading(false)
  }

  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const agoraISO = new Date().toISOString()

  const filtradas = corridas.filter(c => {
    if (filtro === 'todas') return true
    if (filtro === 'em_andamento') return c.status === 'em_andamento'
    if (filtro === 'concluidas') return c.status === 'concluida'
    if (filtro === 'hoje') return c.data_hora.slice(0, 10) === hojeStr
    if (filtro === 'proximas') return c.data_hora >= agoraISO && c.status !== 'concluida' && c.status !== 'cancelada'
    return true
  })

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'proximas',     label: 'Próximas' },
    { id: 'hoje',         label: 'Hoje' },
    { id: 'em_andamento', label: 'Em andamento' },
    { id: 'concluidas',   label: 'Concluídas' },
    { id: 'todas',        label: 'Todas' },
  ]

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#9FE1CB' }} className="text-xs">Agenda</p>
        <p style={{ color: '#E1F5EE' }} className="text-lg font-bold">Suas corridas</p>
      </div>

      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filtros.map(f => (
            <button key={f.id} type="button"
              onClick={() => setFiltro(f.id)}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={filtro === f.id
                ? { background: '#0F6E56', color: '#fff' }
                : { background: '#fff', color: '#666', border: '1px solid #e5e7eb' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-6">Carregando corridas...</p>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-bold text-gray-800">Nenhuma corrida neste filtro</p>
            <p className="text-xs text-gray-500 mt-1">
              {filtro === 'proximas' ? 'Você não tem corridas agendadas pra frente.' : 'Sem resultados aqui.'}
            </p>
          </div>
        )}

        {filtradas.map(c => (
          <CorridaCard key={c.id} c={c} />
        ))}
      </div>
    </div>
  )
}

function CorridaCard({ c }: { c: Corrida }) {
  const st = STATUS_META[c.status] ?? { bg: '#F3F4F6', text: '#6B7280', label: c.status }
  const tp = c.tipo_servico ? TIPO_META[c.tipo_servico] : null
  const passageiro = c.passageiro1_nome || c.cliente_nome || 'Sem nome'
  const data = new Date(c.data_hora)
  const dataFmt = format(data, "dd 'de' MMM · HH:mm", { locale: ptBR })

  return (
    <Link href={`/motorista/corrida/${c.id}`}
      className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-1.5 active:opacity-75"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {tp && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: tp.bg, color: tp.text }}>
              {tp.label}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: st.bg, color: st.text }}>
          {st.label}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-800 leading-snug">
        {c.origem || '—'}
        {c.destino ? ` → ${c.destino}` : ''}
      </p>
      <p className="text-xs text-gray-500">🕐 {dataFmt}</p>
      <p className="text-xs text-gray-500">👤 {passageiro}</p>
      {c.data_hora_termino && (
        <p className="text-[10px] text-gray-400">
          Término previsto: {format(new Date(c.data_hora_termino), 'HH:mm', { locale: ptBR })}
        </p>
      )}
    </Link>
  )
}
