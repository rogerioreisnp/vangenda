'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CaderninhoDigital from '@/components/CaderninhoDigital'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ModalNovaEncomenda from '@/components/ModalNovaEncomenda'

type Despesa = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_despesa: string
  quilometragem?: number
}

type Receita = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_receita: string
}

type AgendamentoReceita = {
  valor: number
  data_viagem: string
  nome_passageiro: string
  parada_origem: string
  parada_destino: string
}

type AgendamentoFiado = {
  id: string
  nome_passageiro: string
  telefone_passageiro?: string
  parada_origem: string
  parada_destino: string
  valor: number
  data_viagem: string
  fiado_valor_pago: number
  fiado_data_combinada?: string
  fiado_observacao?: string
}

type FiadoQuitado = {
  id: string
  nome_passageiro: string
  valor: number
  data_viagem: string
  fiado_forma_pagamento?: string
}

type EncomendaReceita = {
  id: string
  nome: string
  valor: number
  data_pago?: string
  criado_em: string
  forma_pagamento?: string
}

const categoriasReceita = [
  { value: 'rota_diaria', label: 'Rota diária', emoji: '🚐' },
  { value: 'passagens_avulsas', label: 'Passagens avulsas', emoji: '💵' },
  { value: 'frete_empresarial', label: 'Frete empresarial', emoji: '🏢' },
  { value: 'tour_passeio', label: 'Tour / Passeio', emoji: '🎉' },
  { value: 'entrega', label: 'Entrega', emoji: '📦' },
  { value: 'outros', label: 'Outros', emoji: '➕' },
]

const categoriasDespesa = [
  { value: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { value: 'manutencao', label: 'Manutenção', emoji: '🔧' },
  { value: 'pedagio', label: 'Pedágio', emoji: '🛣️' },
  { value: 'pneu', label: 'Pneu', emoji: '🔄' },
  { value: 'outros', label: 'Outros', emoji: '📦' },
]

type Filtro = 'hoje' | '7dias' | '30dias' | 'mes'
type Aba = 'geral' | 'fiado' | 'encomendas'

type Encomenda = {
  id: string
  nome: string
  telefone?: string
  valor: number
  observacao?: string
  pago: boolean
  valor_pago: number
  forma_pagamento?: string
  data_combinada?: string
  criado_em: string
  data_pago?: string
}

function FinanceiroContent() {
  const searchParams = useSearchParams()
  const abaInicial = (searchParams.get('aba') as Aba | null) ?? 'geral'
  const modalInicial = (searchParams.get('modal') as 'receita' | 'despesa' | null) ?? null
  const [aba, setAba] = useState<Aba>(abaInicial)
  const [filtro, setFiltro] = useState<Filtro>('mes')
  const [mes, setMes] = useState(new Date())
  const [receitasManuais, setReceitasManuais] = useState<Receita[]>([])
  const [receitasAgendamentos, setReceitasAgendamentos] = useState<AgendamentoReceita[]>([])
  const [receitasEncomendas, setReceitasEncomendas] = useState<EncomendaReceita[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'receita' | 'despesa'>(modalInicial)
  const [editandoReceita, setEditandoReceita] = useState<Receita | null>(null)
  const [editandoDespesa, setEditandoDespesa] = useState<Despesa | null>(null)

  useEffect(() => { if (aba === 'geral') carregarDados() }, [filtro, mes, aba])

  function getPeriodo() {
    const hoje = new Date()
    if (filtro === 'hoje') return { inicio: format(startOfDay(hoje), 'yyyy-MM-dd'), fim: format(endOfDay(hoje), 'yyyy-MM-dd') }
    if (filtro === '7dias') return { inicio: format(subDays(hoje, 6), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') }
    if (filtro === '30dias') return { inicio: format(subDays(hoje, 29), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') }
    return { inicio: format(startOfMonth(mes), 'yyyy-MM-dd'), fim: format(endOfMonth(mes), 'yyyy-MM-dd') }
  }

  async function carregarDados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { inicio, fim } = getPeriodo()

    const [{ data: recs }, { data: desps }, { data: agends }, { data: encs }] = await Promise.all([
      supabase.from('receitas').select('*').eq('motorista_id', user.id)
        .gte('data_receita', inicio).lte('data_receita', fim).order('data_receita', { ascending: false }),
      supabase.from('despesas').select('*').eq('motorista_id', user.id)
        .gte('data_despesa', inicio).lte('data_despesa', fim).order('data_despesa', { ascending: false }),
      supabase.from('agendamentos').select('valor, data_viagem, nome_passageiro, parada_origem, parada_destino')
        .eq('motorista_id', user.id).neq('status', 'cancelado')
        .gte('data_viagem', inicio).lte('data_viagem', fim)
        .or('forma_pagamento.neq.fiado,forma_pagamento.is.null,fiado_pago.eq.true'),
      supabase.from('encomendas').select('id, nome, valor, data_pago, criado_em, forma_pagamento')
        .eq('motorista_id', user.id).eq('pago', true),
    ])

    if (recs) setReceitasManuais(recs)
    if (desps) setDespesas(desps)
    if (agends) setReceitasAgendamentos(agends)

    // Filtra encomendas pagas pelo período usando data_pago (ou criado_em como fallback)
    if (encs) {
      const encsFiltradas = encs.filter(e => {
        const data = e.data_pago ?? e.criado_em.split('T')[0]
        return data >= inicio && data <= fim
      })
      setReceitasEncomendas(encsFiltradas)
    }

    setLoading(false)
  }

  async function excluirReceita(id: string) {
    if (!confirm('Excluir esta receita?')) return
    const { error } = await supabase.from('receitas').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregarDados()
  }

  async function excluirDespesa(id: string) {
    if (!confirm('Excluir esta despesa?')) return
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregarDados()
  }

  const totalReceitasManuais = receitasManuais.reduce((s, r) => s + r.valor, 0)
  const totalReceitasAgendamentos = receitasAgendamentos.reduce((s, r) => s + r.valor, 0)
  const totalReceitasEncomendas = receitasEncomendas.reduce((s, e) => s + e.valor, 0)
  const totalReceitas = totalReceitasManuais + totalReceitasAgendamentos + totalReceitasEncomendas
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = totalReceitas - totalDespesas

  const despPorCategoria = categoriasDespesa.map(c => ({
    ...c,
    total: despesas.filter(d => d.categoria === c.value).reduce((s, d) => s + d.valor, 0)
  })).filter(c => c.total > 0)

  const recPorCategoria = categoriasReceita.map(c => ({
    ...c,
    total: receitasManuais.filter(r => r.categoria === c.value).reduce((s, r) => s + r.valor, 0)
  })).filter(c => c.total > 0)

  const filtros: { key: Filtro, label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: '7dias', label: '7 dias' },
    { key: '30dias', label: '30 dias' },
    { key: 'mes', label: 'Mês' },
  ]

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <div className="mb-3">
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-2">Financeiro</p>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #085041' }}>
            <button onClick={() => setAba('geral')}
              className="flex-1 py-1.5 text-[11px] font-semibold transition-all"
              style={aba === 'geral'
                ? { background: '#E1F5EE', color: '#0F6E56' }
                : { background: '#085041', color: '#9FE1CB' }}>
              Visão Geral
            </button>
            <button onClick={() => setAba('fiado')}
              className="flex-1 py-1.5 text-[11px] font-semibold transition-all"
              style={aba === 'fiado'
                ? { background: '#E1F5EE', color: '#0F6E56' }
                : { background: '#085041', color: '#9FE1CB' }}>
              Fiado
            </button>
            <button onClick={() => setAba('encomendas')}
              className="flex-1 py-1.5 text-[11px] font-semibold transition-all"
              style={aba === 'encomendas'
                ? { background: '#E1F5EE', color: '#0F6E56' }
                : { background: '#085041', color: '#9FE1CB' }}>
              Encomendas
            </button>
          </div>
        </div>

        {aba === 'geral' && (
          <>
            <div className="flex gap-2 mb-4">
              {filtros.map(f => (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={filtro === f.key
                    ? { background: '#E1F5EE', color: '#0F6E56' }
                    : { background: '#085041', color: '#9FE1CB' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {filtro === 'mes' && (
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setMes(m => subMonths(m, 1))}
                  style={{ background: '#085041', color: '#9FE1CB' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">‹</button>
                <span style={{ color: '#E1F5EE' }} className="text-sm font-semibold capitalize">
                  {format(mes, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button onClick={() => setMes(m => addMonths(m, 1))}
                  style={{ background: '#085041', color: '#9FE1CB' }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold">›</button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div style={{ background: '#085041' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Receitas</p>
                <p style={{ color: '#E1F5EE' }} className="text-base font-bold mt-0.5">R$ {totalReceitas.toFixed(0)}</p>
              </div>
              <div style={{ background: '#085041' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Despesas</p>
                <p style={{ color: '#FAC775' }} className="text-base font-bold mt-0.5">R$ {totalDespesas.toFixed(0)}</p>
              </div>
              <div style={{ background: lucro >= 0 ? '#085041' : '#6B1A1A' }} className="rounded-xl p-3">
                <p style={{ color: '#5DCAA5' }} className="text-[10px]">Lucro</p>
                <p style={{ color: lucro >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold mt-0.5">R$ {lucro.toFixed(0)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {aba === 'fiado' ? (
        <AbaFiado />
      ) : aba === 'encomendas' ? (
        <AbaEncomendas />
      ) : (
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={() => setModal('receita')}
              className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#0F6E56', color: '#fff' }}>
              <span className="text-lg">💰</span> + Receita
            </button>
            <button onClick={() => setModal('despesa')}
              className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: '#A32D2D', color: '#fff' }}>
              <span className="text-lg">🧾</span> + Despesa
            </button>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>
          ) : (
            <>
              {recPorCategoria.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas por categoria</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {recPorCategoria.map((c, i) => {
                      const pct = totalReceitasManuais > 0 ? (c.total / totalReceitasManuais) * 100 : 0
                      return (
                        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center mb-1.5">
                            <span className="text-lg mr-2">{c.emoji}</span>
                            <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                            <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>R$ {c.total.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#f0f0ec' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#1D9E75' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {despPorCategoria.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas por categoria</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {despPorCategoria.map((c, i) => {
                      const pct = totalDespesas > 0 ? (c.total / totalDespesas) * 100 : 0
                      return (
                        <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center mb-1.5">
                            <span className="text-lg mr-2">{c.emoji}</span>
                            <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                            <span className="text-sm font-semibold" style={{ color: '#854F0B' }}>R$ {c.total.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#f0f0ec' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#FAC775' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas lançadas</p>
                {receitasManuais.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">Nenhuma receita lançada</div>
                ) : (
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {receitasManuais.map((r) => {
                      const cat = categoriasReceita.find(c => c.value === r.categoria)
                      return (
                        <div key={r.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                          <span className="text-xl mr-1">{cat?.emoji || '💵'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{cat?.label || r.descricao}</p>
                            <p className="text-xs text-gray-400">{r.descricao} · {format(new Date(r.data_receita + 'T00:00:00'), "dd/MM/yyyy")}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: '#0F6E56' }}>+ R$ {r.valor.toFixed(2).replace('.', ',')}</span>
                          <button
                            onClick={() => setEditandoReceita(r)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}
                            title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirReceita(r.id)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#FDE8E8', color: '#A32D2D' }}
                            title="Excluir">
                            🗑️
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {receitasAgendamentos.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas via passagem</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {receitasAgendamentos.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                        <span className="text-xl mr-3">🚐</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.nome_passageiro}</p>
                          <p className="text-xs text-gray-400">{r.parada_origem} → {r.parada_destino} · {format(new Date(r.data_viagem + 'T00:00:00'), 'dd/MM')}</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>+ R$ {r.valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    {receitasAgendamentos.length > 10 && (
                      <p className="text-center text-xs text-gray-400 py-2">+ {receitasAgendamentos.length - 10} registros</p>
                    )}
                  </div>
                </div>
              )}

              {receitasEncomendas.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas via encomendas</p>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {receitasEncomendas.slice(0, 10).map((e, i) => {
                      const data = e.data_pago ?? e.criado_em.split('T')[0]
                      return (
                        <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                          <span className="text-xl mr-3">📦</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{e.nome}</p>
                            <p className="text-xs text-gray-400">
                              {format(new Date(data + 'T00:00:00'), 'dd/MM')}
                              {e.forma_pagamento ? ` · ${e.forma_pagamento === 'dinheiro' ? '💵' : '📱'} ${e.forma_pagamento}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>+ R$ {e.valor.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )
                    })}
                    {receitasEncomendas.length > 10 && (
                      <p className="text-center text-xs text-gray-400 py-2">+ {receitasEncomendas.length - 10} registros</p>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas</p>
                {despesas.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">Nenhuma despesa registrada</div>
                ) : (
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {despesas.map((d) => {
                      const cat = categoriasDespesa.find(c => c.value === d.categoria)
                      return (
                        <div key={d.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                          <span className="text-xl mr-1">{cat?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{d.descricao}</p>
                            <p className="text-xs text-gray-400">
                              {format(new Date(d.data_despesa + 'T00:00:00'), "dd/MM/yyyy")}
                              {d.quilometragem ? <span className="ml-1 text-gray-300">· {d.quilometragem.toLocaleString('pt-BR')} km</span> : null}
                            </p>
                          </div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: '#A32D2D' }}>- R$ {d.valor.toFixed(2).replace('.', ',')}</span>
                          <button
                            onClick={() => setEditandoDespesa(d)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}
                            title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirDespesa(d.id)}
                            className="p-1.5 rounded-lg shrink-0"
                            style={{ background: '#FDE8E8', color: '#A32D2D' }}
                            title="Excluir">
                            🗑️
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {totalReceitas > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumo do período</p>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Despesas {Math.round((totalDespesas / totalReceitas) * 100)}%</span>
                    <span>Lucro {Math.round((lucro / totalReceitas) * 100)}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex" style={{ background: '#f0f0ec' }}>
                    <div className="h-3 transition-all" style={{ width: `${Math.min((totalDespesas / totalReceitas) * 100, 100)}%`, background: '#FAC775' }} />
                    <div className="h-3 transition-all" style={{ width: `${Math.max((lucro / totalReceitas) * 100, 0)}%`, background: '#1D9E75' }} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs" style={{ color: '#854F0B' }}>R$ {totalDespesas.toFixed(2).replace('.', ',')}</span>
                    <span className="text-xs font-bold" style={{ color: lucro >= 0 ? '#0F6E56' : '#A32D2D' }}>R$ {lucro.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              )}

              <div className="h-24" />
            </>
          )}
        </div>
      )}

      {modal === 'receita' && (
        <FormReceita
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}

      {modal === 'despesa' && (
        <FormDespesa
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); carregarDados() }}
        />
      )}

      {editandoReceita && (
        <FormReceita
          receita={editandoReceita}
          onFechar={() => setEditandoReceita(null)}
          onSalvo={() => { setEditandoReceita(null); carregarDados() }}
        />
      )}

      {editandoDespesa && (
        <FormDespesa
          despesa={editandoDespesa}
          onFechar={() => setEditandoDespesa(null)}
          onSalvo={() => { setEditandoDespesa(null); carregarDados() }}
        />
      )}
    </div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function corAvatar(nome: string) {
  const cores = ['#0F6E56', '#854F0B', '#A32D2D', '#1D4ED8', '#7C3AED', '#B45309']
  return cores[nome.charCodeAt(0) % cores.length]
}

// ─── ABA FIADO ────────────────────────────────────────────────────────────────

function AbaFiado() {
  const [loading, setLoading] = useState(true)
  const [fiados, setFiados] = useState<AgendamentoFiado[]>([])
  const [quitados, setQuitados] = useState<FiadoQuitado[]>([])
  const [motoristaMensagem, setMotoristaMensagem] = useState<string | null>(null)
  const [mostrarQuitados, setMostrarQuitados] = useState(false)
  const [modalBaixaCliente, setModalBaixaCliente] = useState<{ nome: string; total: number; viagens: AgendamentoFiado[] } | null>(null)
  const [modalNovoFiado, setModalNovoFiado] = useState(false)
  const [obsMap, setObsMap] = useState<Record<string, string>>({})
  const [editandoObs, setEditandoObs] = useState<Record<string, boolean>>({})
  const [historicos, setHistoricos] = useState<Record<string, { tipo: string; valor: number; descricao: string | null; created_at: string }[]>>({})
  const [expandidoHist, setExpandidoHist] = useState<Record<string, boolean>>({})
  const [carregandoHist, setCarregandoHist] = useState<Record<string, boolean>>({})
  const [modalAdicionarDivida, setModalAdicionarDivida] = useState<string | null>(null)
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)
  const [agExcluindo, setAgExcluindo] = useState<{ id: string; descricao: string; valor: number } | null>(null)
  const [excluindoAg, setExcluindoAg] = useState(false)
  const [fiadoEditando, setFiadoEditando] = useState<AgendamentoFiado | null>(null)

  useEffect(() => { carregarFiados() }, [])

  useEffect(() => {
    if (clienteSelecionado && !historicos[clienteSelecionado] && !carregandoHist[clienteSelecionado]) {
      carregarHistorico(clienteSelecionado)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelecionado])

  async function carregarFiados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: abertos }, { data: pagos }, { data: mot }] = await Promise.all([
      supabase.from('agendamentos')
        .select('id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, valor, data_viagem, fiado_valor_pago, fiado_data_combinada, fiado_observacao')
        .eq('motorista_id', user.id)
        .eq('forma_pagamento', 'fiado')
        .neq('fiado_pago', true)
        .neq('status', 'cancelado')
        .order('data_viagem', { ascending: false }),
      supabase.from('agendamentos')
        .select('id, nome_passageiro, valor, data_viagem, fiado_forma_pagamento')
        .eq('motorista_id', user.id)
        .eq('forma_pagamento', 'fiado')
        .eq('fiado_pago', true)
        .neq('status', 'cancelado')
        .order('data_viagem', { ascending: false }),
      supabase.from('motoristas').select('mensagem_fiado_whatsapp').eq('id', user.id).single(),
    ])

    if (abertos) {
      setFiados(abertos)
      const init: Record<string, string> = {}
      const seen = new Set<string>()
      abertos.forEach(f => {
        if (!seen.has(f.nome_passageiro)) {
          seen.add(f.nome_passageiro)
          init[f.nome_passageiro] = f.fiado_observacao || ''
        }
      })
      setObsMap(init)
    }
    if (pagos) setQuitados(pagos)
    if (mot) setMotoristaMensagem(mot.mensagem_fiado_whatsapp || null)
    setLoading(false)
  }

  async function carregarHistorico(nome: string) {
    setCarregandoHist(prev => ({ ...prev, [nome]: true }))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('movimentacoes')
      .select('tipo, valor, descricao, created_at')
      .eq('motorista_id', user.id)
      .eq('cliente_nome', nome)
      .in('categoria', ['fiado', 'encomenda'])
      .order('created_at', { ascending: true })
    if (data) setHistoricos(prev => ({ ...prev, [nome]: data }))
    setCarregandoHist(prev => ({ ...prev, [nome]: false }))
  }

  function toggleHistorico(nome: string) {
    const abrindo = !expandidoHist[nome]
    setExpandidoHist(prev => ({ ...prev, [nome]: abrindo }))
    if (abrindo && !historicos[nome]) carregarHistorico(nome)
  }

  function invalidarHistorico(nome: string) {
    setHistoricos(prev => { const n = { ...prev }; delete n[nome]; return n })
  }

  async function excluirAgendamento(id: string) {
    setExcluindoAg(true)
    await Promise.all([
      supabase.from('agendamentos').delete().eq('id', id),
      supabase.from('movimentacoes').delete().eq('referencia_id', id),
    ])
    setExcluindoAg(false)
    setAgExcluindo(null)
    if (clienteSelecionado) invalidarHistorico(clienteSelecionado)
    await carregarFiados()
  }

  async function salvarObservacao(nome: string, viagens: AgendamentoFiado[], valor: string) {
    const ids = viagens.map(v => v.id)
    await supabase.from('agendamentos').update({ fiado_observacao: valor || null }).in('id', ids)
    setEditandoObs(prev => ({ ...prev, [nome]: false }))
  }

  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)

  const devedoresMap = fiados.reduce((acc, f) => {
    const key = f.nome_passageiro
    if (!acc[key]) acc[key] = { nome: f.nome_passageiro, telefone: f.telefone_passageiro, total: 0, viagens: [], temVencido: false }
    acc[key].total += f.valor - (f.fiado_valor_pago || 0)
    acc[key].viagens.push(f)
    if (f.fiado_data_combinada && new Date(f.fiado_data_combinada + 'T00:00:00') < hoje) {
      acc[key].temVencido = true
    }
    return acc
  }, {} as Record<string, { nome: string; telefone?: string; total: number; viagens: AgendamentoFiado[]; temVencido: boolean }>)

  const devedores = Object.values(devedoresMap).sort((a, b) => {
    if (a.temVencido !== b.temVencido) return a.temVencido ? -1 : 1
    return b.total - a.total
  })

  const totalGeral = devedores.reduce((s, d) => s + d.total, 0)
  const totalQuitadoMes = quitados
    .filter(q => { const d = new Date(q.data_viagem + 'T00:00:00'); return d >= inicioMes && d <= fimMes })
    .reduce((s, q) => s + q.valor, 0)

  const quitadosMap = quitados.reduce((acc, q) => {
    if (!acc[q.nome_passageiro]) acc[q.nome_passageiro] = { nome: q.nome_passageiro, total: 0, viagens: [] }
    acc[q.nome_passageiro].total += q.valor
    acc[q.nome_passageiro].viagens.push(q)
    return acc
  }, {} as Record<string, { nome: string; total: number; viagens: FiadoQuitado[] }>)
  const devedoresQuitados = Object.values(quitadosMap)

  function abrirWhatsApp(devedor: { nome: string; telefone?: string; total: number }) {
    if (!devedor.telefone) return
    const tel = devedor.telefone.replace(/\D/g, '')
    const template = motoristaMensagem ||
      'Olá [nome]! Passando para lembrar que você tem um valor em aberto de R$[total] referente às suas viagens. Qualquer dúvida estou à disposição!'
    const msg = template
      .replace('[nome]', devedor.nome.split(' ')[0])
      .replace('[total]', devedor.total.toFixed(2).replace('.', ','))
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>

  // ── EXTRATO: tela de detalhe do cliente ──────────────────────────────
  if (clienteSelecionado !== null) {
    const devedorAtivo = devedoresMap[clienteSelecionado]
    const quitadoGrupo = !devedorAtivo ? quitadosMap[clienteSelecionado] : null
    if (!devedorAtivo && !quitadoGrupo) {
      setTimeout(() => setClienteSelecionado(null), 0)
      return null
    }
    const hist = historicos[clienteSelecionado] || []
    const devedor = devedorAtivo ?? {
      nome: quitadoGrupo!.nome,
      total: 0,
      telefone: undefined as string | undefined,
      viagens: [] as AgendamentoFiado[],
      temVencido: false,
    }
    const totalCobrado = devedorAtivo
      ? devedor.viagens.reduce((s, v) => s + v.valor, 0)
      : hist.filter(m => m.tipo === 'divida').reduce((s, m) => s + m.valor, 0)
    const totalRecebido = devedorAtivo
      ? devedor.viagens.reduce((s, v) => s + (v.fiado_valor_pago || 0), 0)
      : hist.filter(m => m.tipo === 'pagamento').reduce((s, m) => s + m.valor, 0)
    const pagamentosHist = hist.filter(m => m.tipo === 'pagamento')
    const iniciais = devedor.nome.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()
    const entradas = devedorAtivo
      ? [
          ...devedor.viagens.map(v => ({
            tipo: 'divida' as const,
            data: v.data_viagem,
            descricao: v.parada_destino
              ? `${v.parada_origem} → ${v.parada_destino}`
              : (v.parada_origem || 'Passagem fiada'),
            valor: v.valor,
            valorPago: v.fiado_valor_pago || 0,
            dataCombinada: v.fiado_data_combinada as string | undefined,
            id: v.id,
          })),
          ...pagamentosHist.map(p => ({
            tipo: 'pagamento' as const,
            data: p.created_at.substring(0, 10),
            descricao: p.descricao || 'Pagamento recebido',
            valor: p.valor,
            valorPago: 0,
            dataCombinada: undefined as string | undefined,
            id: undefined as string | undefined,
          })),
        ].sort((a, b) => a.data.localeCompare(b.data))
      : hist.map(m => ({
          tipo: m.tipo as 'divida' | 'pagamento',
          data: m.created_at.substring(0, 10),
          descricao: m.descricao || (m.tipo === 'divida' ? 'Passagem fiada' : 'Pagamento recebido'),
          valor: m.valor,
          valorPago: 0,
          dataCombinada: undefined as string | undefined,
          id: undefined as string | undefined,
        })).sort((a, b) => a.data.localeCompare(b.data))

    return (
      <div style={{ background: '#f0f0ec', minHeight: '100%' }}>
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setClienteSelecionado(null)}
            className="text-2xl text-gray-400 leading-none pr-2 active:opacity-50">‹</button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: corAvatar(devedor.nome) }}>
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{devedor.nome}</p>
            <p className="text-xs text-gray-400">
              {devedor.viagens.length} lançamento{devedor.viagens.length !== 1 ? 's' : ''}
            </p>
          </div>
          {devedor.telefone && (
            <button onClick={() => abrirWhatsApp(devedor)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#E7F9EE' }}>💬</button>
          )}
        </div>

        <div className="px-4 pt-4 pb-40 flex flex-col gap-4">
          {/* Barra de resumo */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Cobrado</p>
                <p className="text-sm font-bold text-gray-800">R$ {totalCobrado.toFixed(0)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Recebido</p>
                <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>R$ {totalRecebido.toFixed(0)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Saldo</p>
                <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>R$ {devedor.total.toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div>
            {obsMap[devedor.nome] && !editandoObs[devedor.nome] ? (
              <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                <p className="text-xs text-gray-500 flex-1 leading-relaxed">{obsMap[devedor.nome]}</p>
                <button onClick={() => setEditandoObs(prev => ({ ...prev, [devedor.nome]: true }))}
                  className="text-sm shrink-0">✏️</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <textarea
                  value={obsMap[devedor.nome] || ''}
                  onChange={e => setObsMap(prev => ({ ...prev, [devedor.nome]: e.target.value }))}
                  placeholder="Observação (ex: vai pagar na sexta)..."
                  rows={1}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 resize-none outline-none bg-white"
                  style={{ color: '#444' }}
                />
                <button
                  onClick={() => salvarObservacao(devedor.nome, devedor.viagens, obsMap[devedor.nome] || '')}
                  className="text-xs px-3 py-2 rounded-xl font-semibold shrink-0"
                  style={{ background: '#E1F5EE', color: '#0F6E56' }}>Salvar</button>
              </div>
            )}
          </div>

          {/* Lista cronológica */}
          {carregandoHist[clienteSelecionado] && entradas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">Carregando histórico...</p>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {entradas.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Nenhum lançamento</p>
              ) : entradas.map((e, i) => {
                const vencida = e.tipo === 'divida' && e.dataCombinada
                  ? new Date(e.dataCombinada + 'T00:00:00') < hoje : false
                return (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={e.tipo === 'divida'
                        ? { background: '#FCEBEB', color: '#A32D2D' }
                        : { background: '#E1F5EE', color: '#0F6E56' }}>
                      {e.tipo === 'divida' ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 leading-relaxed">{e.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(e.data + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
                      {e.tipo === 'divida' && e.valorPago > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#854F0B' }}>
                          Parcial: R$ {e.valorPago.toFixed(2).replace('.', ',')} pago
                        </p>
                      )}
                      {e.tipo === 'divida' && e.dataCombinada && (
                        <p className="text-xs mt-0.5" style={{ color: vencida ? '#A32D2D' : '#6b7280' }}>
                          {vencida ? '⚠️ Venceu: ' : 'Combina: '}
                          {format(new Date(e.dataCombinada + 'T00:00:00'), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold"
                        style={{ color: e.tipo === 'divida' ? '#A32D2D' : '#0F6E56' }}>
                        {e.tipo === 'divida' ? '+' : '−'} R$ {e.valor.toFixed(2).replace('.', ',')}
                      </p>
                      {e.tipo === 'divida' && e.valorPago > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          saldo R$ {(e.valor - e.valorPago).toFixed(2).replace('.', ',')}
                        </p>
                      )}
                      {e.tipo === 'divida' && e.id && (
                        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                          <button onClick={() => setFiadoEditando(devedor.viagens.find(v => v.id === e.id) || null)}
                            className="text-xs opacity-30 active:opacity-100">✏️</button>
                          <button
                            onClick={() => setAgExcluindo({ id: e.id!, descricao: e.descricao, valor: e.valor })}
                            className="text-xs opacity-30 active:opacity-100">🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-100 flex gap-2 z-40"
          style={{ padding: '12px 16px 12px 16px' }}>
          <button onClick={() => setModalAdicionarDivida(clienteSelecionado)}
            className="flex-1 flex items-center justify-center"
            style={{ height: 48, background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D', borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
            📝 + Adicionar
          </button>
          {devedor.total > 0.001 && (
            <button
              onClick={() => setModalBaixaCliente({ nome: devedor.nome, total: devedor.total, viagens: devedor.viagens })}
              className="flex-1 flex items-center justify-center"
              style={{ height: 48, background: '#1B5E20', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
              ✓ Dar baixa — R$ {devedor.total.toFixed(2).replace('.', ',')}
            </button>
          )}
        </div>

        {modalBaixaCliente && (
          <ModalDarBaixaCliente
            cliente={modalBaixaCliente}
            onFechar={() => setModalBaixaCliente(null)}
            onSalvo={() => {
              const nome = modalBaixaCliente.nome
              invalidarHistorico(nome)
              setModalBaixaCliente(null)
              carregarFiados()
              carregarHistorico(nome)
            }}
          />
        )}
        {modalAdicionarDivida && (
          <ModalAdicionarDivida
            nome={modalAdicionarDivida}
            onFechar={() => setModalAdicionarDivida(null)}
            onSalvo={() => {
              const nome = modalAdicionarDivida
              invalidarHistorico(nome)
              setModalAdicionarDivida(null)
              carregarFiados()
              carregarHistorico(nome)
            }}
          />
        )}
        {agExcluindo && (
          <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={ev => { if (ev.target === ev.currentTarget) setAgExcluindo(null) }}>
            <div className="w-full bg-white rounded-t-2xl p-6 pb-16">
              <p className="text-base font-bold text-gray-800 mb-1">Excluir lançamento</p>
              <p className="text-sm text-gray-600 mb-1">{agExcluindo.descricao}</p>
              <p className="text-sm font-semibold mb-4" style={{ color: '#A32D2D' }}>
                R$ {agExcluindo.valor.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-xs text-gray-400 mb-5">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setAgExcluindo(null)}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold border border-gray-200"
                  style={{ color: '#6b7280' }}>
                  Cancelar
                </button>
                <button onClick={() => excluirAgendamento(agExcluindo.id)} disabled={excluindoAg}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                  {excluindoAg ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
        {fiadoEditando && (
          <ModalEditarFiado
            ag={fiadoEditando}
            onFechar={() => setFiadoEditando(null)}
            onSalvo={() => {
              const nome = clienteSelecionado!
              invalidarHistorico(nome)
              setFiadoEditando(null)
              carregarFiados()
              carregarHistorico(nome)
            }}
          />
        )}
      </div>
    )
  }

  // ── LISTA: tela principal ─────────────────────────────────────────────
  return (
    <div className="px-4 py-4">
      <button
        onClick={() => setModalNovoFiado(true)}
        className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mb-4"
        style={{ background: '#FAEEDA', color: '#854F0B' }}>
        📝 + Novo fiado
      </button>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Em aberto</p>
          <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>R$ {totalGeral.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Quitado/mês</p>
          <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>R$ {totalQuitadoMes.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Devedores</p>
          <p className="text-sm font-bold text-gray-800">{devedores.length}</p>
        </div>
      </div>

      {devedores.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-600 font-medium text-sm">Nenhum fiado em aberto</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {devedores.map(devedor => {
            const iniciais = devedor.nome.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()
            const ultimaData = devedor.viagens[0]?.data_viagem
            return (
              <button key={devedor.nome}
                onClick={() => setClienteSelecionado(devedor.nome)}
                className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:opacity-75"
                style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: corAvatar(devedor.nome) }}>
                  {iniciais}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {devedor.temVencido && <span className="text-xs leading-none">⚠️</span>}
                    <p className="text-sm font-bold text-gray-800 truncate">{devedor.nome}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {devedor.viagens.length} lançamento{devedor.viagens.length !== 1 ? 's' : ''}
                    {ultimaData && ` · último ${format(new Date(ultimaData + 'T00:00:00'), 'dd/MM')}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>
                    R$ {devedor.total.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-gray-300">›</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Quitados */}
      <div className="mt-5">
        <button
          onClick={() => setMostrarQuitados(m => !m)}
          className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 flex items-center justify-center gap-2"
          style={{ background: mostrarQuitados ? '#E1F5EE' : 'white', color: mostrarQuitados ? '#0F6E56' : '#666' }}>
          {mostrarQuitados ? '▲ Esconder quitados' : `▼ Ver quitados (${quitados.length})`}
        </button>

        {mostrarQuitados && (
          <div className="flex flex-col gap-3 mt-3">
            {devedoresQuitados.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">Nenhum fiado quitado ainda</p>
            ) : devedoresQuitados.map(dq => {
              const ini = dq.nome.split(' ').slice(0, 2).map((p: string) => p[0] || '').join('').toUpperCase()
              const ultima = dq.viagens[0]?.data_viagem
              return (
                <button key={dq.nome} onClick={() => setClienteSelecionado(dq.nome)}
                  className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:opacity-75"
                  style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: corAvatar(dq.nome) }}>
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{dq.nome}</p>
                    <p className="text-xs text-gray-400">
                      {dq.viagens.length} lançamento{dq.viagens.length !== 1 ? 's' : ''}
                      {ultima && ` · último ${format(new Date(ultima + 'T00:00:00'), 'dd/MM')}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: '#D1FAE5', color: '#065F46' }}>Quitado ✓</span>
                    <p className="text-xs text-gray-300 mt-0.5">›</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="h-24" />

      {modalNovoFiado && (
        <ModalNovoFiado
          onFechar={() => setModalNovoFiado(false)}
          onSalvo={() => { setModalNovoFiado(false); carregarFiados() }}
        />
      )}
    </div>
  )
}

// ─── MODAL NOVO FIADO ─────────────────────────────────────────────────────────

function ModalNovoFiado({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [form, setForm] = useState({ nome: '', telefone: '', valor: '', descricao: '', data_combinada: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.nome.trim() || !form.valor) { setErro('Nome e valor são obrigatórios.'); return }
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Não autenticado.'); setSaving(false); return }

    const { data: rota } = await supabase.from('rotas').select('id').eq('motorista_id', user.id).limit(1).single()

    const { data: novoAg, error } = await supabase.from('agendamentos').insert({
      motorista_id: user.id,
      rota_id: rota?.id ?? null,
      nome_passageiro: form.nome.trim(),
      telefone_passageiro: form.telefone.trim() || null,
      parada_origem: form.descricao.trim() || 'Entrada manual',
      parada_destino: '',
      data_viagem: format(new Date(), 'yyyy-MM-dd'),
      turno: 'ida',
      valor: parseFloat(form.valor),
      forma_pagamento: 'fiado',
      fiado_pago: false,
      status: 'agendado',
      fiado_data_combinada: form.data_combinada || null,
    }).select('id').single()

    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    if (novoAg) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: form.nome.trim(),
        tipo: 'divida',
        valor: parseFloat(form.valor),
        descricao: form.descricao.trim() || 'Passagem fiada',
        categoria: 'fiado',
        referencia_id: novoAg.id,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Novo fiado</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Nome do devedor *</p>
          <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: João Silva"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Telefone (opcional)</p>
          <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
            placeholder="(95) 99999-9999" type="tel"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$) *</p>
          <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            placeholder="0,00" type="number" step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Descrição da viagem (opcional)</p>
          <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex: Ida Campinas 10/06"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data combinada para pagar (opcional)</p>
          <input value={form.data_combinada} onChange={e => setForm(f => ({ ...f, data_combinada: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <button onClick={salvar} disabled={saving || !form.nome || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Lançar fiado'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL ADICIONAR DÍVIDA ───────────────────────────────────────────────────

function ModalAdicionarDivida({ nome, onFechar, onSalvo }: {
  nome: string
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({ descricao: '', valor: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.descricao.trim() || !form.valor) { setErro('Descrição e valor são obrigatórios.'); return }
    const valorNum = parseFloat(form.valor)
    if (isNaN(valorNum) || valorNum <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Não autenticado.'); setSaving(false); return }

    const { data: rota } = await supabase.from('rotas').select('id').eq('motorista_id', user.id).limit(1).single()

    const { data: novoAg, error } = await supabase.from('agendamentos').insert({
      motorista_id: user.id,
      rota_id: rota?.id ?? null,
      nome_passageiro: nome,
      parada_origem: form.descricao.trim(),
      parada_destino: '',
      data_viagem: format(new Date(), 'yyyy-MM-dd'),
      turno: 'ida',
      valor: valorNum,
      forma_pagamento: 'fiado',
      fiado_pago: false,
      status: 'agendado',
    }).select('id').single()

    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    if (novoAg) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: nome,
        tipo: 'divida',
        valor: valorNum,
        descricao: form.descricao.trim(),
        categoria: 'fiado',
        referencia_id: novoAg.id,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-800">Adicionar dívida</p>
            <p className="text-xs text-gray-400 mt-0.5">{nome}</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Descrição *</p>
          <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex: Passagem, Encomenda Correios..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$) *</p>
          <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            placeholder="0,00" type="number" step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#854F0B' }}>
          {saving ? 'Salvando...' : '✓ Adicionar à conta'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL DAR BAIXA ──────────────────────────────────────────────────────────

function ModalDarBaixa({ viagem, onFechar, onSalvo }: {
  viagem: AgendamentoFiado
  onFechar: () => void
  onSalvo: () => void
}) {
  const saldoRestante = viagem.valor - (viagem.fiado_valor_pago || 0)
  const [valorRecebido, setValorRecebido] = useState(saldoRestante.toFixed(2))
  const [dataCombinada, setDataCombinada] = useState(viagem.fiado_data_combinada || '')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [saving, setSaving] = useState(false)

  const vr = parseFloat(valorRecebido) || 0
  const isTotal = vr >= saldoRestante - 0.001
  const novoSaldo = Math.max(0, saldoRestante - vr)

  async function confirmar() {
    if (!vr || vr <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const novoPago = (viagem.fiado_valor_pago || 0) + vr
    const updates: Record<string, unknown> = {
      fiado_valor_pago: parseFloat(Math.min(novoPago, viagem.valor).toFixed(2)),
      fiado_forma_pagamento: formaPagamento,
    }
    if (isTotal) {
      updates.fiado_pago = true
    } else if (dataCombinada) {
      updates.fiado_data_combinada = dataCombinada
    }
    await supabase.from('agendamentos').update(updates).eq('id', viagem.id)
    if (user) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: viagem.nome_passageiro,
        tipo: 'pagamento',
        valor: parseFloat(vr.toFixed(2)),
        descricao: 'Pagamento recebido (' + formaPagamento + ')',
        categoria: 'fiado',
        referencia_id: viagem.id,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Dar baixa no fiado</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#f0f0ec' }}>
          <p className="text-xs text-gray-500 mb-0.5">{viagem.nome_passageiro}</p>
          <p className="text-sm text-gray-700">
            {viagem.parada_origem} → {viagem.parada_destino} · {format(new Date(viagem.data_viagem + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
          <p className="text-sm font-bold mt-1" style={{ color: '#A32D2D' }}>
            Saldo em aberto: R$ {saldoRestante.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor recebido (R$)</p>
          <input
            type="number" step="0.01" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {vr > 0 && !isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#FAEEDA', borderColor: '#FAC775' }}>
            <p className="text-xs" style={{ color: '#854F0B' }}>
              Pagando R$ {vr.toFixed(2).replace('.', ',')} — ainda ficará devendo R$ {novoSaldo.toFixed(2).replace('.', ',')}
            </p>
          </div>
        )}

        {vr > 0 && !isTotal && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data combinada para pagar o restante (opcional)</p>
            <input
              type="date" value={dataCombinada}
              onChange={e => setDataCombinada(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'dinheiro', label: '💵 Dinheiro' },
              { value: 'pix', label: '📱 Pix' },
            ] as const).map(f => (
              <button key={f.value} onClick={() => setFormaPagamento(f.value)}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={formaPagamento === f.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {vr > 0 && isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
              ✓ Quitação total — fiado será marcado como pago
            </p>
          </div>
        )}

        <button onClick={confirmar} disabled={saving || vr <= 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving
            ? 'Salvando...'
            : isTotal
            ? '✓ Confirmar quitação'
            : '✓ Registrar pagamento parcial'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL DAR BAIXA CLIENTE (FIADO) ─────────────────────────────────────────

function ModalDarBaixaCliente({ cliente, onFechar, onSalvo }: {
  cliente: { nome: string; total: number; viagens: AgendamentoFiado[] }
  onFechar: () => void
  onSalvo: () => void
}) {
  const [valorRecebido, setValorRecebido] = useState(cliente.total.toFixed(2))
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [saving, setSaving] = useState(false)

  const vr = parseFloat(valorRecebido) || 0
  const isTotal = vr >= cliente.total - 0.001
  const novoSaldo = Math.max(0, cliente.total - vr)

  async function confirmar() {
    if (!vr || vr <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const viagensOrdenadas = [...cliente.viagens].sort((a, b) => a.data_viagem.localeCompare(b.data_viagem))
    let restante = vr
    for (const v of viagensOrdenadas) {
      if (restante <= 0.001) break
      const saldo = v.valor - (v.fiado_valor_pago || 0)
      if (saldo <= 0.001) continue
      const pagar = Math.min(saldo, restante)
      restante = parseFloat((restante - pagar).toFixed(2))
      const novoPago = parseFloat(Math.min((v.fiado_valor_pago || 0) + pagar, v.valor).toFixed(2))
      const updates: Record<string, unknown> = {
        fiado_valor_pago: novoPago,
        fiado_forma_pagamento: formaPagamento,
      }
      if (novoPago >= v.valor - 0.001) updates.fiado_pago = true
      await supabase.from('agendamentos').update(updates).eq('id', v.id)
    }

    if (user) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: cliente.nome,
        tipo: 'pagamento',
        valor: parseFloat(vr.toFixed(2)),
        descricao: 'Pagamento recebido (' + formaPagamento + ')',
        categoria: 'fiado',
        referencia_id: null,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Dar baixa no fiado</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#f0f0ec' }}>
          <p className="text-sm font-bold text-gray-800">{cliente.nome}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cliente.viagens.length} lançamento{cliente.viagens.length !== 1 ? 's' : ''} em aberto</p>
          <p className="text-sm font-bold mt-1" style={{ color: '#A32D2D' }}>
            Total em aberto: R$ {cliente.total.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor recebido (R$)</p>
          <input
            type="number" step="0.01" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {vr > 0 && !isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#FAEEDA', borderColor: '#FAC775' }}>
            <p className="text-xs" style={{ color: '#854F0B' }}>
              Pagando R$ {vr.toFixed(2).replace('.', ',')} — ainda ficará devendo R$ {novoSaldo.toFixed(2).replace('.', ',')}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'dinheiro', label: '💵 Dinheiro' },
              { value: 'pix', label: '📱 Pix' },
            ] as const).map(f => (
              <button key={f.value} onClick={() => setFormaPagamento(f.value)}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={formaPagamento === f.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {vr > 0 && isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
              ✓ Quitação total — todos os fiados serão marcados como pagos
            </p>
          </div>
        )}

        <button onClick={confirmar} disabled={saving || vr <= 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving
            ? 'Salvando...'
            : isTotal
            ? '✓ Confirmar quitação'
            : '✓ Registrar pagamento parcial'}
        </button>
      </div>
    </div>
  )
}

// ─── ABA ENCOMENDAS ───────────────────────────────────────────────────────────

function AbaEncomendas() {
  const [loading, setLoading] = useState(true)
  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
  const [quitadas, setQuitadas] = useState<Encomenda[]>([])
  const [modalNova, setModalNova] = useState<{nome?: string; telefone?: string} | null>(null)
  const [modalBaixaClienteEncomenda, setModalBaixaClienteEncomenda] = useState<{ nome: string; total: number; encomendas: Encomenda[] } | null>(null)
  const [editEncomenda, setEditEncomenda] = useState<Encomenda | null>(null)
  const [encExcluindo, setEncExcluindo] = useState<Encomenda | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [mostrarQuitadas, setMostrarQuitadas] = useState(false)
  const [clienteSelecionadoEnc, setClienteSelecionadoEnc] = useState<string | null>(null)
  const [historicosEnc, setHistoricosEnc] = useState<Record<string, { tipo: string; valor: number; descricao: string | null; created_at: string }[]>>({})
  const [carregandoHistEnc, setCarregandoHistEnc] = useState<Record<string, boolean>>({})

  useEffect(() => { carregarEncomendas() }, [])

  useEffect(() => {
    if (clienteSelecionadoEnc && !historicosEnc[clienteSelecionadoEnc] && !carregandoHistEnc[clienteSelecionadoEnc]) {
      carregarHistoricoEnc(clienteSelecionadoEnc)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelecionadoEnc])

  async function carregarEncomendas() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: abertas }, { data: pagas }] = await Promise.all([
      supabase.from('encomendas').select('*').eq('motorista_id', user.id).neq('pago', true).order('criado_em', { ascending: false }),
      supabase.from('encomendas').select('*').eq('motorista_id', user.id).eq('pago', true).order('criado_em', { ascending: false }),
    ])

    if (abertas) setEncomendas(abertas)
    if (pagas) setQuitadas(pagas)
    setLoading(false)
  }

  async function carregarHistoricoEnc(nome: string) {
    setCarregandoHistEnc(prev => ({ ...prev, [nome]: true }))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('movimentacoes')
      .select('tipo, valor, descricao, created_at')
      .eq('motorista_id', user.id)
      .eq('cliente_nome', nome)
      .eq('categoria', 'encomenda')
      .order('created_at', { ascending: true })
    if (data) setHistoricosEnc(prev => ({ ...prev, [nome]: data }))
    setCarregandoHistEnc(prev => ({ ...prev, [nome]: false }))
  }

  function invalidarHistoricoEnc(nome: string) {
    setHistoricosEnc(prev => { const n = { ...prev }; delete n[nome]; return n })
  }

  async function excluirEncomenda(enc: Encomenda) {
    setExcluindo(true)
    const { error } = await supabase.from('encomendas').delete().eq('id', enc.id)
    setExcluindo(false)
    if (error) return
    setEncExcluindo(null)
    if (clienteSelecionadoEnc) invalidarHistoricoEnc(clienteSelecionadoEnc)
    await carregarEncomendas()
  }

  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)

  const pedidoresMap = encomendas.reduce((acc, e) => {
    const key = e.nome
    if (!acc[key]) acc[key] = { nome: e.nome, telefone: e.telefone, total: 0, encomendas: [], temVencido: false }
    acc[key].total += e.valor - (e.valor_pago || 0)
    acc[key].encomendas.push(e)
    if (e.data_combinada && new Date(e.data_combinada + 'T00:00:00') < hoje) acc[key].temVencido = true
    return acc
  }, {} as Record<string, { nome: string; telefone?: string; total: number; encomendas: Encomenda[]; temVencido: boolean }>)

  const pedidores = Object.values(pedidoresMap).sort((a, b) => {
    if (a.temVencido !== b.temVencido) return a.temVencido ? -1 : 1
    return b.total - a.total
  })

  const totalGeral = pedidores.reduce((s, p) => s + p.total, 0)
  const totalQuitadoMes = quitadas
    .filter(q => { const d = new Date(q.criado_em); return d >= inicioMes && d <= fimMes })
    .reduce((s, q) => s + q.valor, 0)

  const quitadasMap = quitadas.reduce((acc, q) => {
    if (!acc[q.nome]) acc[q.nome] = { nome: q.nome, total: 0, encomendas: [] }
    acc[q.nome].total += q.valor
    acc[q.nome].encomendas.push(q)
    return acc
  }, {} as Record<string, { nome: string; total: number; encomendas: Encomenda[] }>)
  const pedidoresQuitados = Object.values(quitadasMap)

  function abrirWhatsApp(p: { nome: string; telefone?: string; total: number }) {
    if (!p.telefone) return
    const tel = p.telefone.replace(/\D/g, '')
    const msg = `Olá ${p.nome.split(' ')[0]}! Passando para lembrar que você tem uma encomenda pendente no valor de R$${p.total.toFixed(2).replace('.', ',')}. Qualquer dúvida estou à disposição!`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>

  // ── EXTRATO: tela de detalhe do cliente ──────────────────────────────
  if (clienteSelecionadoEnc !== null) {
    const pedidorAtivo = pedidoresMap[clienteSelecionadoEnc]
    const quitadoGrupoEnc = !pedidorAtivo ? quitadasMap[clienteSelecionadoEnc] : null
    if (!pedidorAtivo && !quitadoGrupoEnc) {
      setTimeout(() => setClienteSelecionadoEnc(null), 0)
      return null
    }
    const pedidor = pedidorAtivo ?? {
      nome: quitadoGrupoEnc!.nome,
      total: 0,
      telefone: quitadoGrupoEnc!.encomendas[0]?.telefone,
      encomendas: quitadoGrupoEnc!.encomendas,
      temVencido: false,
    }
    const totalCobrado = pedidor.encomendas.reduce((s, e) => s + e.valor, 0)
    const totalRecebido = pedidor.encomendas.reduce((s, e) => s + (e.valor_pago || 0), 0)
    const pagamentosHist = (historicosEnc[clienteSelecionadoEnc] || []).filter(m => m.tipo === 'pagamento')
    const iniciais = pedidor.nome.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()
    const entradas = [
      ...pedidor.encomendas.map(enc => ({
        tipo: 'divida' as const,
        data: enc.criado_em.substring(0, 10),
        descricao: enc.observacao || 'Encomenda',
        valor: enc.valor,
        valorPago: enc.valor_pago || 0,
        dataCombinada: enc.data_combinada as string | undefined,
      })),
      ...pagamentosHist.map(p => ({
        tipo: 'pagamento' as const,
        data: p.created_at.substring(0, 10),
        descricao: p.descricao || 'Pagamento recebido',
        valor: p.valor,
        valorPago: 0,
        dataCombinada: undefined as string | undefined,
      })),
    ].sort((a, b) => a.data.localeCompare(b.data))

    return (
      <div style={{ background: '#f0f0ec', minHeight: '100%' }}>
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setClienteSelecionadoEnc(null)}
            className="text-2xl text-gray-400 leading-none pr-2 active:opacity-50">‹</button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: corAvatar(pedidor.nome) }}>
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{pedidor.nome}</p>
            <p className="text-xs text-gray-400">
              {pedidor.encomendas.length} encomenda{pedidor.encomendas.length !== 1 ? 's' : ''}
            </p>
          </div>
          {pedidor.telefone && (
            <button onClick={() => abrirWhatsApp(pedidor)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#E7F9EE' }}>💬</button>
          )}
        </div>

        <div className="px-4 pt-4 pb-40 flex flex-col gap-4">
          {/* Barra de resumo */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Cobrado</p>
                <p className="text-sm font-bold text-gray-800">R$ {totalCobrado.toFixed(0)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Recebido</p>
                <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>R$ {totalRecebido.toFixed(0)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Saldo</p>
                <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>R$ {pedidor.total.toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Lista cronológica */}
          {carregandoHistEnc[clienteSelecionadoEnc] && entradas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">Carregando histórico...</p>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {entradas.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Nenhum lançamento</p>
              ) : entradas.map((e, i) => {
                const vencida = e.tipo === 'divida' && e.dataCombinada
                  ? new Date(e.dataCombinada + 'T00:00:00') < hoje : false
                return (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={e.tipo === 'divida'
                        ? { background: '#FAEEDA', color: '#854F0B' }
                        : { background: '#E1F5EE', color: '#0F6E56' }}>
                      {e.tipo === 'divida' ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 leading-relaxed">{e.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(e.data + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
                      {e.tipo === 'divida' && e.valorPago > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#854F0B' }}>
                          Parcial: R$ {e.valorPago.toFixed(2).replace('.', ',')} pago
                        </p>
                      )}
                      {e.tipo === 'divida' && e.dataCombinada && (
                        <p className="text-xs mt-0.5" style={{ color: vencida ? '#A32D2D' : '#6b7280' }}>
                          {vencida ? '⚠️ Venceu: ' : 'Pagar até: '}
                          {format(new Date(e.dataCombinada + 'T00:00:00'), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold"
                        style={{ color: e.tipo === 'divida' ? '#854F0B' : '#0F6E56' }}>
                        {e.tipo === 'divida' ? '+' : '−'} R$ {e.valor.toFixed(2).replace('.', ',')}
                      </p>
                      {e.tipo === 'divida' && e.valorPago > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          saldo R$ {(e.valor - e.valorPago).toFixed(2).replace('.', ',')}
                        </p>
                      )}
                      {e.tipo === 'divida' && (
                        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                          <button onClick={() => setEditEncomenda(pedidor.encomendas.find(x => x.criado_em.startsWith(e.data)) || null)}
                            className="text-xs opacity-30 active:opacity-100">✏️</button>
                          <button onClick={() => setEncExcluindo(pedidor.encomendas.find(x => x.criado_em.startsWith(e.data)) || null)}
                            className="text-xs opacity-30 active:opacity-100">🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-100 flex gap-2 z-40"
          style={{ padding: '12px 16px 12px 16px' }}>
          <button onClick={() => setModalNova({ nome: pedidor.nome, telefone: pedidor.telefone })}
            className="flex-1 flex items-center justify-center"
            style={{ height: 48, background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D', borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
            📦 + Adicionar
          </button>
          {pedidor.total > 0.001 && (
            <button
              onClick={() => setModalBaixaClienteEncomenda({ nome: pedidor.nome, total: pedidor.total, encomendas: pedidor.encomendas })}
              className="flex-1 flex items-center justify-center"
              style={{ height: 48, background: '#1B5E20', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
              ✓ Dar baixa — R$ {pedidor.total.toFixed(2).replace('.', ',')}
            </button>
          )}
        </div>

        {modalNova !== null && (
          <ModalNovaEncomenda
            nomeInicial={modalNova.nome}
            telefoneInicial={modalNova.telefone}
            onFechar={() => setModalNova(null)}
            onSalvo={() => { setModalNova(null); carregarEncomendas() }}
          />
        )}
        {editEncomenda && (
          <ModalEditarEncomenda
            encomenda={editEncomenda}
            onFechar={() => setEditEncomenda(null)}
            onSalvo={() => { setEditEncomenda(null); carregarEncomendas() }}
          />
        )}
        {encExcluindo && (
          <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={ev => { if (ev.target === ev.currentTarget) setEncExcluindo(null) }}>
            <div className="w-full bg-white rounded-t-2xl p-6 pb-16">
              <p className="text-base font-bold text-gray-800 mb-1">Excluir encomenda</p>
              <p className="text-sm text-gray-600 mb-1">{encExcluindo.observacao || 'Encomenda'}</p>
              <p className="text-sm font-semibold mb-4" style={{ color: '#854F0B' }}>
                R$ {encExcluindo.valor.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-xs text-gray-400 mb-5">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setEncExcluindo(null)}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold border border-gray-200"
                  style={{ color: '#6b7280' }}>
                  Cancelar
                </button>
                <button onClick={() => excluirEncomenda(encExcluindo)} disabled={excluindo}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                  {excluindo ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
        {modalBaixaClienteEncomenda && (
          <ModalDarBaixaClienteEncomenda
            cliente={modalBaixaClienteEncomenda}
            onFechar={() => setModalBaixaClienteEncomenda(null)}
            onSalvo={() => {
              const nome = modalBaixaClienteEncomenda.nome
              invalidarHistoricoEnc(nome)
              setModalBaixaClienteEncomenda(null)
              carregarEncomendas()
              carregarHistoricoEnc(nome)
            }}
          />
        )}
      </div>
    )
  }

  // ── LISTA: tela principal ─────────────────────────────────────────────
  return (
    <div className="px-4 py-4">
      <button onClick={() => setModalNova({})}
        className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mb-4"
        style={{ background: '#FAEEDA', color: '#854F0B' }}>
        📦 + Nova encomenda
      </button>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Em aberto</p>
          <p className="text-sm font-bold" style={{ color: '#A32D2D' }}>R$ {totalGeral.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Quitado/mês</p>
          <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>R$ {totalQuitadoMes.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase leading-tight mb-1">Pendentes</p>
          <p className="text-sm font-bold text-gray-800">{encomendas.length}</p>
        </div>
      </div>

      {pedidores.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-gray-600 font-medium text-sm">Nenhuma encomenda pendente</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidores.map(pedidor => {
            const iniciais = pedidor.nome.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase()
            const ultimaData = pedidor.encomendas[0]?.criado_em
            return (
              <button key={pedidor.nome}
                onClick={() => setClienteSelecionadoEnc(pedidor.nome)}
                className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:opacity-75"
                style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: corAvatar(pedidor.nome) }}>
                  {iniciais}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {pedidor.temVencido && <span className="text-xs leading-none">⚠️</span>}
                    <p className="text-sm font-bold text-gray-800 truncate">{pedidor.nome}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {pedidor.encomendas.length} encomenda{pedidor.encomendas.length !== 1 ? 's' : ''}
                    {ultimaData && ` · último ${format(new Date(ultimaData.substring(0, 10) + 'T00:00:00'), 'dd/MM')}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold" style={{ color: '#854F0B' }}>
                    R$ {pedidor.total.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-xs text-gray-300">›</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Quitadas */}
      <div className="mt-5">
        <button onClick={() => setMostrarQuitadas(m => !m)}
          className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 flex items-center justify-center gap-2"
          style={{ background: mostrarQuitadas ? '#E1F5EE' : 'white', color: mostrarQuitadas ? '#0F6E56' : '#666' }}>
          {mostrarQuitadas ? '▲ Esconder quitadas' : `▼ Ver quitadas (${quitadas.length})`}
        </button>

        {mostrarQuitadas && (
          <div className="flex flex-col gap-3 mt-3">
            {pedidoresQuitados.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">Nenhuma encomenda quitada ainda</p>
            ) : pedidoresQuitados.map(pq => {
              const ini = pq.nome.split(' ').slice(0, 2).map((p: string) => p[0] || '').join('').toUpperCase()
              const ultima = pq.encomendas[0]?.criado_em
              return (
                <button key={pq.nome} onClick={() => setClienteSelecionadoEnc(pq.nome)}
                  className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:opacity-75"
                  style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: corAvatar(pq.nome) }}>
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{pq.nome}</p>
                    <p className="text-xs text-gray-400">
                      {pq.encomendas.length} encomenda{pq.encomendas.length !== 1 ? 's' : ''}
                      {ultima && ` · último ${format(new Date(ultima), 'dd/MM')}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: '#D1FAE5', color: '#065F46' }}>Quitado ✓</span>
                    <p className="text-xs text-gray-300 mt-0.5">›</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="h-24" />

      {modalNova !== null && (
        <ModalNovaEncomenda
          nomeInicial={modalNova.nome}
          telefoneInicial={modalNova.telefone}
          onFechar={() => setModalNova(null)}
          onSalvo={() => { setModalNova(null); carregarEncomendas() }}
        />
      )}
    </div>
  )
}

// ─── MODAL EDITAR FIADO ───────────────────────────────────────────────────────

function ModalEditarFiado({ ag, onFechar, onSalvo }: {
  ag: AgendamentoFiado; onFechar: () => void; onSalvo: () => void
}) {
  const [form, setForm] = useState({
    valor: ag.valor.toFixed(2),
    fiado_observacao: ag.fiado_observacao ?? '',
    fiado_data_combinada: ag.fiado_data_combinada ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(v) || v <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('agendamentos').update({
        valor: v,
        fiado_observacao: form.fiado_observacao.trim() || null,
        fiado_data_combinada: form.fiado_data_combinada || null,
      }).eq('id', ag.id),
      supabase.from('movimentacoes').update({ valor: v }).eq('referencia_id', ag.id),
    ])
    if (e1 || e2) { setErro('Erro ao salvar.'); setSaving(false); return }
    setSaving(false)
    onSalvo()
  }

  const descricao = ag.parada_destino
    ? `${ag.parada_origem} → ${ag.parada_destino}`
    : (ag.parada_origem || 'Passagem fiada')

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Editar lançamento</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#f5f5f5' }}>
          <span className="font-semibold text-gray-700">{ag.nome_passageiro}</span>
          <span className="text-gray-400"> · {descricao}</span>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$) *</p>
          <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            type="number" step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <textarea value={form.fiado_observacao} onChange={e => setForm(f => ({ ...f, fiado_observacao: e.target.value }))}
            placeholder="Ex: vai pagar na sexta"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white resize-none focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data combinada (opcional)</p>
          <input value={form.fiado_data_combinada} onChange={e => setForm(f => ({ ...f, fiado_data_combinada: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <button onClick={salvar} disabled={saving || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL EDITAR ENCOMENDA ───────────────────────────────────────────────────

function ModalEditarEncomenda({ encomenda, onFechar, onSalvo }: {
  encomenda: Encomenda; onFechar: () => void; onSalvo: () => void
}) {
  const [form, setForm] = useState({
    valor: encomenda.valor.toFixed(2),
    observacao: encomenda.observacao ?? '',
    data_combinada: encomenda.data_combinada ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(v) || v <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true)
    const { error } = await supabase.from('encomendas').update({
      valor: v,
      observacao: form.observacao.trim() || null,
      data_combinada: form.data_combinada || null,
    }).eq('id', encomenda.id)
    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Editar encomenda</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#f5f5f5' }}>
          <span className="font-semibold text-gray-700">{encomenda.nome}</span>
          {encomenda.telefone && <span className="text-gray-400"> · {encomenda.telefone}</span>}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$) *</p>
          <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            type="number" step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="Ex: buscar correio capital, caixa azul, dia 15"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white resize-none focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data combinada (opcional)</p>
          <input value={form.data_combinada} onChange={e => setForm(f => ({ ...f, data_combinada: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <button onClick={salvar} disabled={saving || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL DAR BAIXA ENCOMENDA ────────────────────────────────────────────────

function ModalDarBaixaEncomenda({ encomenda, onFechar, onSalvo }: {
  encomenda: Encomenda
  onFechar: () => void
  onSalvo: () => void
}) {
  const saldoRestante = encomenda.valor - (encomenda.valor_pago || 0)
  const [valorRecebido, setValorRecebido] = useState(saldoRestante.toFixed(2))
  const [dataCombinada, setDataCombinada] = useState(encomenda.data_combinada || '')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [saving, setSaving] = useState(false)

  const vr = parseFloat(valorRecebido) || 0
  const isTotal = vr >= saldoRestante - 0.001
  const novoSaldo = Math.max(0, saldoRestante - vr)

  async function confirmar() {
    if (!vr || vr <= 0) return
    setSaving(true)
    const novoPago = (encomenda.valor_pago || 0) + vr
    const updates: Record<string, unknown> = {
      valor_pago: parseFloat(Math.min(novoPago, encomenda.valor).toFixed(2)),
      forma_pagamento: formaPagamento,
    }
    if (isTotal) {
      updates.pago = true
      updates.data_pago = format(new Date(), 'yyyy-MM-dd')
    } else if (dataCombinada) {
      updates.data_combinada = dataCombinada
    }
    await supabase.from('encomendas').update(updates).eq('id', encomenda.id)
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Dar baixa na encomenda</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#f0f0ec' }}>
          <p className="text-xs text-gray-500 mb-0.5">{encomenda.nome}</p>
          {encomenda.observacao && <p className="text-xs text-gray-500 mb-0.5">{encomenda.observacao}</p>}
          <p className="text-sm font-bold mt-1" style={{ color: '#A32D2D' }}>
            Saldo em aberto: R$ {saldoRestante.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor recebido (R$)</p>
          <input type="number" step="0.01" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {vr > 0 && !isTotal && (
          <div className="border rounded-xl px-4 py-3" style={{ background: '#FAEEDA', borderColor: '#FAC775' }}>
            <p className="text-xs" style={{ color: '#854F0B' }}>
              Pagando R$ {vr.toFixed(2).replace('.', ',')} — ainda ficará devendo R$ {novoSaldo.toFixed(2).replace('.', ',')}
            </p>
          </div>
        )}

        {vr > 0 && !isTotal && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data combinada para pagar o restante (opcional)</p>
            <input type="date" value={dataCombinada}
              onChange={e => setDataCombinada(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'dinheiro', label: '💵 Dinheiro' },
              { value: 'pix', label: '📱 Pix' },
            ] as const).map(f => (
              <button key={f.value} onClick={() => setFormaPagamento(f.value)}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={formaPagamento === f.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {vr > 0 && isTotal && (
          <div className="border rounded-xl px-4 py-3" style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
              ✓ Quitação total — encomenda será marcada como paga
            </p>
          </div>
        )}

        <button onClick={confirmar} disabled={saving || vr <= 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : isTotal ? '✓ Confirmar quitação' : '✓ Registrar pagamento parcial'}
        </button>
      </div>
    </div>
  )
}

// ─── MODAL DAR BAIXA CLIENTE ENCOMENDA ───────────────────────────────────────

function ModalDarBaixaClienteEncomenda({ cliente, onFechar, onSalvo }: {
  cliente: { nome: string; total: number; encomendas: Encomenda[] }
  onFechar: () => void
  onSalvo: () => void
}) {
  const [valorRecebido, setValorRecebido] = useState(cliente.total.toFixed(2))
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [saving, setSaving] = useState(false)

  const vr = parseFloat(valorRecebido) || 0
  const isTotal = vr >= cliente.total - 0.001
  const novoSaldo = Math.max(0, cliente.total - vr)

  async function confirmar() {
    if (!vr || vr <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const encOrdenadas = [...cliente.encomendas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    let restante = vr
    for (const enc of encOrdenadas) {
      if (restante <= 0.001) break
      const saldo = enc.valor - (enc.valor_pago || 0)
      if (saldo <= 0.001) continue
      const pagar = Math.min(saldo, restante)
      restante = parseFloat((restante - pagar).toFixed(2))
      const novoPago = parseFloat(Math.min((enc.valor_pago || 0) + pagar, enc.valor).toFixed(2))
      const updates: Record<string, unknown> = {
        valor_pago: novoPago,
        forma_pagamento: formaPagamento,
      }
      if (novoPago >= enc.valor - 0.001) {
        updates.pago = true
        updates.data_pago = format(new Date(), 'yyyy-MM-dd')
      }
      await supabase.from('encomendas').update(updates).eq('id', enc.id)
    }

    if (user) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: cliente.nome,
        tipo: 'pagamento',
        valor: parseFloat(vr.toFixed(2)),
        descricao: 'Pagamento recebido (' + formaPagamento + ')',
        categoria: 'encomenda',
        referencia_id: null,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Dar baixa nas encomendas</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#f0f0ec' }}>
          <p className="text-sm font-bold text-gray-800">{cliente.nome}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cliente.encomendas.length} encomenda{cliente.encomendas.length !== 1 ? 's' : ''} em aberto</p>
          <p className="text-sm font-bold mt-1" style={{ color: '#A32D2D' }}>
            Total em aberto: R$ {cliente.total.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor recebido (R$)</p>
          <input
            type="number" step="0.01" value={valorRecebido}
            onChange={e => setValorRecebido(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {vr > 0 && !isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#FAEEDA', borderColor: '#FAC775' }}>
            <p className="text-xs" style={{ color: '#854F0B' }}>
              Pagando R$ {vr.toFixed(2).replace('.', ',')} — ainda ficará devendo R$ {novoSaldo.toFixed(2).replace('.', ',')}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'dinheiro', label: '💵 Dinheiro' },
              { value: 'pix', label: '📱 Pix' },
            ] as const).map(f => (
              <button key={f.value} onClick={() => setFormaPagamento(f.value)}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={formaPagamento === f.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {vr > 0 && isTotal && (
          <div className="border rounded-xl px-4 py-3"
            style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
              ✓ Quitação total — todas as encomendas serão marcadas como pagas
            </p>
          </div>
        )}

        <button onClick={confirmar} disabled={saving || vr <= 0}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving
            ? 'Salvando...'
            : isTotal
            ? '✓ Confirmar quitação'
            : '✓ Registrar pagamento parcial'}
        </button>
      </div>
    </div>
  )
}

// ─── FORM RECEITA ─────────────────────────────────────────────────────────────

function FormReceita({
  receita,
  onFechar,
  onSalvo,
}: {
  receita?: Receita
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    categoria: receita?.categoria ?? 'rota_diaria',
    descricao: receita?.descricao ?? '',
    valor: receita?.valor?.toString() ?? '',
    data_receita: receita?.data_receita ?? format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.valor) return
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Usuário não autenticado.'); setSaving(false); return }

    const cat = categoriasReceita.find(c => c.value === form.categoria)
    const payload = {
      motorista_id: user.id,
      categoria: form.categoria,
      descricao: form.descricao || cat?.label || '',
      valor: parseFloat(form.valor),
      data_receita: form.data_receita,
    }

    let error
    if (receita) {
      ;({ error } = await supabase.from('receitas').update(payload).eq('id', receita.id))
    } else {
      ;({ error } = await supabase.from('receitas').insert(payload))
    }

    if (error) {
      console.error('Erro receita:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
          {receita ? 'Editar receita' : 'Lançar receita'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Tipo de receita</p>
          <div className="grid grid-cols-3 gap-2">
            {categoriasReceita.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, categoria: c.value }))}
                className="py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all"
                style={form.categoria === c.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                <span className="text-lg">{c.emoji}</span>
                <span className="text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <input value={form.descricao}
            onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
            type="text" placeholder="Ex: empresa tal, grupo de amigos..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor (R$)</p>
          <input value={form.valor}
            onChange={e => setForm(prev => ({ ...prev, valor: e.target.value }))}
            type="number" placeholder="0,00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Data</p>
          <input value={form.data_receita}
            onChange={e => setForm(prev => ({ ...prev, data_receita: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
      </div>

      <div className="px-4 pb-16 pt-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : receita ? '✓ Atualizar receita' : '💰 Salvar receita'}
        </button>
      </div>
    </div>
  )
}

// ─── FORM DESPESA ─────────────────────────────────────────────────────────────

function FormDespesa({
  despesa,
  onFechar,
  onSalvo,
}: {
  despesa?: Despesa
  onFechar: () => void
  onSalvo: () => void
}) {
  const categoriasComKm = ['combustivel', 'manutencao', 'pneu', 'outros']
  const [form, setForm] = useState({
    descricao: despesa?.descricao ?? '',
    categoria: despesa?.categoria ?? 'combustivel',
    valor: despesa?.valor?.toString() ?? '',
    data_despesa: despesa?.data_despesa ?? format(new Date(), 'yyyy-MM-dd'),
    quilometragem: despesa?.quilometragem?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Usuário não autenticado.'); setSaving(false); return }

    const payload = {
      motorista_id: user.id,
      descricao: form.descricao,
      categoria: form.categoria,
      valor: parseFloat(form.valor),
      data_despesa: form.data_despesa,
      quilometragem: (categoriasComKm.includes(form.categoria) && form.quilometragem)
        ? parseInt(form.quilometragem) : null,
    }

    let error
    if (despesa) {
      ;({ error } = await supabase.from('despesas').update(payload).eq('id', despesa.id))
    } else {
      ;({ error } = await supabase.from('despesas').insert(payload))
    }

    if (error) {
      console.error('Erro despesa:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
          {despesa ? 'Editar despesa' : 'Nova despesa'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Categoria</p>
          <div className="grid grid-cols-3 gap-2">
            {categoriasDespesa.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, categoria: c.value }))}
                className="py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all"
                style={form.categoria === c.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                <span className="text-lg">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {[
          { label: 'Descrição', key: 'descricao', type: 'text', placeholder: 'Ex: Abastecimento posto BR' },
          { label: 'Valor (R$)', key: 'valor', type: 'number', placeholder: '0,00' },
          { label: 'Data', key: 'data_despesa', type: 'date', placeholder: '' },
        ].map(f => (
          <div key={f.key}>
            <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
            <input value={(form as any)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              type={f.type} placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        ))}

        {categoriasComKm.includes(form.categoria) && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Quilometragem (km) <span className="text-gray-300 font-normal">— opcional</span></p>
            <input value={form.quilometragem}
              onChange={e => setForm(prev => ({ ...prev, quilometragem: e.target.value }))}
              type="number" placeholder="Ex: 45000"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        )}

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
      </div>

      <div className="px-4 pb-16 pt-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : despesa ? '✓ Atualizar despesa' : '✓ Salvar despesa'}
        </button>
      </div>
    </div>
  )
}

export default function FinanceiroPage() {
  return (
    <Suspense>
      <FinanceiroContent />
    </Suspense>
  )
}
