'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

type Periodo = 'mes_atual' | 'ultimos_7' | 'ultimos_30'
type Aba = 'resumo' | 'receitas' | 'despesas' | 'veiculo'

type CorridaFin = {
  id: string
  origem: string
  destino: string
  data_hora: string
  valor: number
  status: string
  cliente_nome: string
  motorista_id: string | null
  valor_recebido: number | null
  motoristas_empresa: { nome: string; veiculo: string | null; placa: string | null } | null
}

type Despesa = {
  id: string
  motorista_id: string | null
  veiculo: string | null
  categoria: string
  descricao: string
  valor: number
  km_odometro: number | null
  data: string
}

type Motorista = {
  id: string
  nome: string
  veiculo: string | null
  placa: string | null
}

type FormDespesa = {
  categoria: string
  descricao: string
  valor: string
  veiculo: string
  km_odometro: string
  data: string
  motorista_id: string
}

const FORM_VAZIO: FormDespesa = {
  categoria: 'combustivel',
  descricao: '',
  valor: '',
  veiculo: '',
  km_odometro: '',
  data: '',
  motorista_id: '',
}

const CATEGORIAS = [
  { valor: 'combustivel',       label: 'Combustível',         emoji: '⛽' },
  { valor: 'manutencao',        label: 'Manutenção',          emoji: '🔧' },
  { valor: 'pneus',             label: 'Pneus',               emoji: '⭕' },
  { valor: 'seguro',            label: 'Seguro',              emoji: '🛡️' },
  { valor: 'ipva_licenciamento',label: 'IPVA/Licenciamento',  emoji: '📄' },
  { valor: 'lavagem',           label: 'Lavagem',             emoji: '🚿' },
  { valor: 'pedagio',           label: 'Pedágio',             emoji: '🛂' },
  { valor: 'multa',             label: 'Multa',               emoji: '⚠️' },
  { valor: 'outros',            label: 'Outros',              emoji: '📦' },
] as const

type CatValor = typeof CATEGORIAS[number]['valor']
const catMap = Object.fromEntries(CATEGORIAS.map(c => [c.valor, c])) as Record<string, { valor: string; label: string; emoji: string }>

export default function FinanceiroPage() {
  const [empresaId, setEmpresaId]   = useState<string | null>(null)
  const [periodo, setPeriodo]       = useState<Periodo>('mes_atual')
  const [aba, setAba]               = useState<Aba>('resumo')
  const [corridas, setCorridas]     = useState<CorridaFin[]>([])
  const [despesas, setDespesas]     = useState<Despesa[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]     = useState<Despesa | null>(null)
  const [form, setForm]             = useState<FormDespesa>(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  useEffect(() => { inicializar() }, [])
  useEffect(() => { if (empresaId) carregar(empresaId) }, [empresaId, periodo])

  async function inicializar() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores').select('empresa_id').eq('user_id', session.user.id).single()
    if (!gestor) return

    setEmpresaId(gestor.empresa_id)

    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('id, nome, veiculo, placa')
      .eq('empresa_id', gestor.empresa_id)
      .eq('status', 'ativo')
      .order('nome')

    if (mots) setMotoristas(mots)
  }

  function intervalo(): { inicio: string; fim: string } {
    const hoje = new Date()
    if (periodo === 'mes_atual') {
      return {
        inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
        fim:    format(endOfMonth(hoje),   'yyyy-MM-dd'),
      }
    }
    const dias = periodo === 'ultimos_7' ? 6 : 29
    return {
      inicio: format(subDays(hoje, dias), 'yyyy-MM-dd'),
      fim:    format(hoje,                'yyyy-MM-dd'),
    }
  }

  async function carregar(eid: string) {
    setLoading(true)

    await supabase.from('corridas_empresa')
      .update({ status: 'concluida' })
      .eq('empresa_id', eid)
      .eq('status', 'confirmada')
      .lt('data_hora', new Date().toISOString())

    const { inicio, fim } = intervalo()

    const [{ data: corr }, { data: desp }] = await Promise.all([
      supabase
        .from('corridas_empresa')
        .select('id, origem, destino, data_hora, valor, status, cliente_nome, motorista_id, valor_recebido, motoristas_empresa(nome, veiculo, placa)')
        .eq('empresa_id', eid)
        .gte('data_hora', `${inicio}T00:00:00`)
        .lte('data_hora', `${fim}T23:59:59`)
        .order('data_hora', { ascending: false }),
      supabase
        .from('despesas_empresa')
        .select('id, motorista_id, veiculo, categoria, descricao, valor, km_odometro, data')
        .eq('empresa_id', eid)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false }),
    ])

    setCorridas((corr as any) ?? [])
    setDespesas(desp ?? [])
    setLoading(false)
  }

  function abrirNova() {
    setEditando(null)
    setForm({ ...FORM_VAZIO, data: format(new Date(), 'yyyy-MM-dd') })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(d: Despesa) {
    setEditando(d)
    setForm({
      categoria:    d.categoria,
      descricao:    d.descricao,
      valor:        String(d.valor),
      veiculo:      d.veiculo ?? '',
      km_odometro:  d.km_odometro != null ? String(d.km_odometro) : '',
      data:         d.data,
      motorista_id: d.motorista_id ?? '',
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.descricao.trim()) { setErro('Descrição é obrigatória'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!empresaId) return

    setSalvando(true)
    setErro('')

    const payload = {
      empresa_id:   empresaId,
      categoria:    form.categoria,
      descricao:    form.descricao.trim(),
      valor,
      veiculo:      form.veiculo.trim() || null,
      km_odometro:  form.km_odometro ? parseInt(form.km_odometro) : null,
      data:         form.data,
      motorista_id: form.motorista_id || null,
    }

    const { error } = editando
      ? await supabase.from('despesas_empresa').update(payload).eq('id', editando.id)
      : await supabase.from('despesas_empresa').insert(payload)

    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setModalAberto(false)
    carregar(empresaId)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta despesa?')) return
    await supabase.from('despesas_empresa').delete().eq('id', id)
    if (empresaId) carregar(empresaId)
  }

  /* ── Cálculos ── */
  const corridasConcluidas = corridas.filter(c => c.status === 'concluida')
  const corridasAReceber   = corridas.filter(c => c.status === 'confirmada')
  const totalRec      = corridasConcluidas.reduce((s, c) => s + Number(c.valor), 0)
  const totalAReceber = corridasAReceber.reduce((s, c) => s + Number(c.valor) - Number(c.valor_recebido || 0), 0)
  const totalDesp     = despesas.reduce((s, d) => s + Number(d.valor), 0)
  const lucro         = totalRec - totalDesp
  const motMap        = Object.fromEntries(motoristas.map(m => [m.id, m]))

  /* ── Agrupar por veículo ── */
  type VItem = { key: string; nome: string; veiculo: string; receita: number; despesa: number; qtd: number }
  const vMap = new Map<string, VItem>()

  corridasConcluidas.forEach(c => {
    const key  = c.motorista_id ?? '__sem__'
    const mot  = c.motoristas_empresa as any
    const nome = mot?.nome ?? 'Sem motorista'
    const veic = [mot?.veiculo, mot?.placa].filter(Boolean).join(' · ') || 'Sem veículo'
    if (!vMap.has(key)) vMap.set(key, { key, nome, veiculo: veic, receita: 0, despesa: 0, qtd: 0 })
    const item = vMap.get(key)!
    item.receita += Number(c.valor)
    item.qtd++
  })

  despesas.forEach(d => {
    const key = d.motorista_id ?? '__sem__'
    if (!vMap.has(key)) {
      const m   = d.motorista_id ? motMap[d.motorista_id] : undefined
      const veic = [m?.veiculo, m?.placa].filter(Boolean).join(' · ') || d.veiculo || 'Sem veículo'
      vMap.set(key, { key, nome: m?.nome ?? 'Sem motorista', veiculo: veic, receita: 0, despesa: 0, qtd: 0 })
    }
    vMap.get(key)!.despesa += Number(d.valor)
  })

  const veiculos = Array.from(vMap.values())
    .sort((a, b) => (b.receita - b.despesa) - (a.receita - a.despesa))

  const periodoLabel = periodo === 'mes_atual'
    ? format(new Date(), 'MMMM yyyy', { locale: ptBR })
    : periodo === 'ultimos_7' ? 'Últimos 7 dias' : 'Últimos 30 dias'

  const fmt = (v: number) =>
    `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
          <div className="flex-1 min-w-0">
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Financeiro</p>
            <p style={{ color: '#5DCAA5' }} className="text-xs capitalize">{periodoLabel}</p>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="flex gap-2 mb-3">
          {(['mes_atual', 'ultimos_7', 'ultimos_30'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={periodo === p
                ? { background: '#E1F5EE', color: '#085041' }
                : { background: '#085041', color: '#9FE1CB' }}>
              {p === 'mes_atual' ? 'Este mês' : p === 'ultimos_7' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>

        {/* Abas */}
        <div className="flex">
          {(['resumo', 'receitas', 'despesas', 'veiculo'] as Aba[]).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className="flex-1 py-2.5 text-[11px] font-semibold border-b-2"
              style={aba === a
                ? { borderColor: '#9FE1CB', color: '#E1F5EE', background: 'transparent' }
                : { borderColor: 'transparent', color: '#5DCAA5', background: 'transparent' }}>
              {a === 'resumo' ? 'Resumo' : a === 'receitas' ? 'Receitas' : a === 'despesas' ? 'Despesas' : 'Veículos'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-4xl animate-pulse">💰</div>
          </div>

        ) : aba === 'resumo' ? (
          /* ── Resumo ── */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">💰 Receita realizada</p>
                <p className="text-xl font-bold" style={{ color: '#0F6E56' }}>{fmt(totalRec)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">🕐 A receber</p>
                <p className="text-xl font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalAReceber)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">📤 Despesas</p>
                <p className="text-xl font-bold" style={{ color: '#A32D2D' }}>{fmt(totalDesp)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">📊 Ticket médio</p>
                <p className="text-xl font-bold" style={{ color: '#185FA5' }}>
                  {corridasConcluidas.length > 0 ? fmt(totalRec / corridasConcluidas.length) : 'R$ 0'}
                </p>
              </div>

              {/* Lucro — destaque */}
              <div className="col-span-2 rounded-2xl p-4 border"
                style={{
                  background:   lucro >= 0 ? '#E1F5EE' : '#FCEBEB',
                  borderColor:  lucro >= 0 ? '#9FE1CB' : '#FECACA',
                }}>
                <p className="text-xs mb-2" style={{ color: lucro >= 0 ? '#085041' : '#A32D2D' }}>
                  {lucro >= 0 ? '📈' : '📉'} Lucro real
                </p>
                <p className="text-2xl font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>
                  {lucro < 0 ? '-' : ''}{fmt(lucro)}
                </p>
              </div>

              <div className="col-span-2 bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 mb-2">🚐 Corridas concluídas</p>
                <p className="text-xl font-bold" style={{ color: '#6B7280' }}>{corridasConcluidas.length}</p>
              </div>
            </div>
          </div>

        ) : aba === 'receitas' ? (
          /* ── Receitas ── */
          <div className="flex flex-col gap-4">
            {/* Realizadas */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0F6E56' }}>
                  ✅ Realizadas · {corridasConcluidas.length}
                </p>
                {corridasConcluidas.length > 0 && (
                  <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>{fmt(totalRec)}</p>
                )}
              </div>
              {corridasConcluidas.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">Nenhuma corrida concluída no período</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {corridasConcluidas.map(c => {
                    const mot = c.motoristas_empresa as any
                    return (
                      <div key={c.id} className="bg-white rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{c.origem} → {c.destino}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} · {c.cliente_nome}
                            </p>
                            {mot?.nome && <p className="text-xs text-gray-400">🚐 {mot.nome}</p>}
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>{fmt(Number(c.valor))}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* A receber */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                  🕐 A receber · {corridasAReceber.length}
                </p>
                {corridasAReceber.length > 0 && (
                  <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalAReceber)}</p>
                )}
              </div>
              {corridasAReceber.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">Nenhuma corrida agendada no período</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {corridasAReceber.map(c => {
                    const mot = c.motoristas_empresa as any
                    return (
                      <div key={c.id} className="rounded-2xl p-3 border" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{c.origem} → {c.destino}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)} às {c.data_hora.slice(11, 16)} · {c.cliente_nome}
                            </p>
                            {mot?.nome && <p className="text-xs text-gray-400">🚐 {mot.nome}</p>}
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: '#1D4ED8' }}>{fmt(Number(c.valor))}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        ) : aba === 'despesas' ? (
          /* ── Despesas ── */
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {despesas.length} despesa{despesas.length !== 1 ? 's' : ''}
              </p>
              {despesas.length > 0 && (
                <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>{fmt(totalDesp)}</p>
              )}
            </div>
            <button onClick={abrirNova}
              className="w-full py-3 rounded-xl text-sm font-semibold mb-3"
              style={{ background: '#1D9E75', color: '#fff' }}>
              + Adicionar despesa
            </button>
            {despesas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-400">Nenhuma despesa no período</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {despesas.map(d => {
                  const cat = catMap[d.categoria] ?? { label: d.categoria, emoji: '📦' }
                  const m = d.motorista_id ? motMap[d.motorista_id] : undefined
                  return (
                    <div key={d.id} className="bg-white rounded-2xl p-3 border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: '#FCEBEB' }}>
                          {cat.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{d.descricao}</p>
                          <p className="text-xs text-gray-400">
                            {cat.label} · {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                          </p>
                          {(m || d.veiculo) && (
                            <p className="text-xs text-gray-400">
                              🚐 {[m?.nome, d.veiculo].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {d.km_odometro != null && (
                            <p className="text-xs text-gray-400">
                              📏 {d.km_odometro.toLocaleString('pt-BR')} km
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>
                            {fmt(Number(d.valor))}
                          </p>
                          <div className="flex gap-1">
                            <button onClick={() => abrirEditar(d)}
                              className="px-2 py-1 rounded-lg text-[10px] font-medium"
                              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                              ✏️
                            </button>
                            <button onClick={() => excluir(d.id)}
                              className="px-2 py-1 rounded-lg text-[10px] font-medium"
                              style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        ) : (
          /* ── Veículos ── */
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resultado por veículo
            </p>
            {veiculos.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">🚐</p>
                <p className="text-sm text-gray-400">Nenhum dado no período</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {veiculos.map(v => {
                  const lv = v.receita - v.despesa
                  return (
                    <div key={v.key} className="bg-white rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{v.nome}</p>
                          <p className="text-xs text-gray-400">{v.veiculo}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                          style={lv >= 0
                            ? { background: '#E1F5EE', color: '#0F6E56' }
                            : { background: '#FCEBEB', color: '#A32D2D' }}>
                          {lv >= 0 ? '+' : '-'}{fmt(lv)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Receita</p>
                          <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>{fmt(v.receita)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Despesas</p>
                          <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>{fmt(v.despesa)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Corridas</p>
                          <p className="text-sm font-bold text-gray-700">{v.qtd}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <div className="h-20" />
      </div>

      {/* Modal nova/editar despesa */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {editando ? 'Editar despesa' : 'Nova despesa'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-3">
            <Campo label="Categoria">
              <select value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="campo-input">
                {CATEGORIAS.map(c => (
                  <option key={c.valor} value={c.valor}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Descrição *">
              <input value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Abastecimento — posto BR km 45"
                className="campo-input" />
            </Campo>

            <Campo label="Valor (R$) *">
              <input type="number" step="0.01" min={0}
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                className="campo-input" />
            </Campo>

            <Campo label="Data *">
              <input type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="campo-input" />
            </Campo>

            <Campo label="Motorista (opcional)">
              <select value={form.motorista_id}
                onChange={e => {
                  const id = e.target.value
                  const m = motoristas.find(m => m.id === id)
                  setForm(f => ({
                    ...f,
                    motorista_id: id,
                    veiculo: id && m ? [m.veiculo, m.placa].filter(Boolean).join(' ') : f.veiculo,
                  }))
                }}
                className="campo-input">
                <option value="">Selecionar...</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome}{m.veiculo ? ` · ${m.veiculo}` : ''}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Veículo">
              <input value={form.veiculo}
                onChange={e => setForm(f => ({ ...f, veiculo: e.target.value }))}
                placeholder="Ex: Sprinter · ABC-1234"
                className="campo-input" />
            </Campo>

            <Campo label="KM odômetro (opcional)">
              <input type="number" min={0}
                value={form.km_odometro}
                onChange={e => setForm(f => ({ ...f, km_odometro: e.target.value }))}
                placeholder="Ex: 125000"
                className="campo-input" />
            </Campo>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px 80px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : '✓ Registrar despesa'}
            </button>
          </div>

          <style jsx>{`
            .campo-input {
              width: 100%; padding: 10px 12px; border-radius: 12px;
              border: 1px solid #e5e7eb; font-size: 14px; color: #222;
              background: #fff; outline: none;
            }
            .campo-input:focus { border-color: #1D9E75; }
          `}</style>
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
