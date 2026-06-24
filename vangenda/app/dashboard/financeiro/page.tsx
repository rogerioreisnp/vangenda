'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Despesa = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_despesa: string
}

const categorias = [
  { value: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { value: 'manutencao', label: 'Manutenção', emoji: '🔧' },
  { value: 'pedagio', label: 'Pedágio', emoji: '🛣️' },
  { value: 'pneu', label: 'Pneu', emoji: '🔄' },
  { value: 'outros', label: 'Outros', emoji: '📦' },
]

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date())
  const [receitas, setReceitas] = useState<any[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarDados() }, [mes])

  async function carregarDados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inicio = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd')

    const { data: recs } = await supabase.from('agendamentos')
      .select('valor, data_viagem, nome_passageiro, parada_origem, parada_destino')
      .eq('motorista_id', user.id)
      .neq('status', 'cancelado')
      .gte('data_viagem', inicio)
      .lte('data_viagem', fim)

    const { data: desps } = await supabase.from('despesas')
      .select('*')
      .eq('motorista_id', user.id)
      .gte('data_despesa', inicio)
      .lte('data_despesa', fim)
      .order('data_despesa', { ascending: false })

    if (recs) setReceitas(recs)
    if (desps) setDespesas(desps)
    setLoading(false)
  }

  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0)
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const lucro = totalReceitas - totalDespesas

  const despPorCategoria = categorias.map(c => ({
    ...c,
    total: despesas.filter(d => d.categoria === c.value).reduce((s, d) => s + d.valor, 0)
  })).filter(c => c.total > 0)

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold mb-1">Financeiro</p>

        {/* Navegação mês */}
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

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-2">
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Receitas</p>
            <p style={{ color: '#E1F5EE' }} className="text-base font-bold mt-0.5">
              R$ {totalReceitas.toFixed(0)}
            </p>
          </div>
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Despesas</p>
            <p style={{ color: '#FAC775' }} className="text-base font-bold mt-0.5">
              R$ {totalDespesas.toFixed(0)}
            </p>
          </div>
          <div style={{ background: lucro >= 0 ? '#085041' : '#6B1A1A' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Lucro</p>
            <p style={{ color: lucro >= 0 ? '#E1F5EE' : '#FAC775' }} className="text-base font-bold mt-0.5">
              R$ {lucro.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Despesas por categoria */}
        {despPorCategoria.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas por categoria</p>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
              {despPorCategoria.map((c, i) => (
                <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-xl mr-3">{c.emoji}</span>
                  <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                  <span className="text-sm font-semibold" style={{ color: '#854F0B' }}>
                    R$ {c.total.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de despesas */}
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Despesas do mês</p>
          <button onClick={() => setMostrarForm(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
            + Nova despesa
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-6">Carregando...</p>
        ) : despesas.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">Nenhuma despesa registrada</div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
            {despesas.map((d, i) => {
              const cat = categorias.find(c => c.value === d.categoria)
              return (
                <div key={d.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-xl mr-3">{cat?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.descricao}</p>
                    <p className="text-xs text-gray-400">{format(new Date(d.data_despesa + 'T00:00:00'), "dd/MM")}</p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#A32D2D' }}>
                    - R$ {d.valor.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Receitas resumo */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Receitas do mês</p>
        {receitas.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">Nenhuma receita registrada</div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
            {receitas.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                <span className="text-xl mr-3">🚗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.nome_passageiro}</p>
                  <p className="text-xs text-gray-400">{r.parada_origem} → {r.parada_destino} · {format(new Date(r.data_viagem + 'T00:00:00'), 'dd/MM')}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                  + R$ {r.valor.toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
            {receitas.length > 10 && (
              <p className="text-center text-xs text-gray-400 py-2">+ {receitas.length - 10} registros</p>
            )}
          </div>
        )}
      </div>

      {mostrarForm && (
        <FormDespesa onFechar={() => setMostrarForm(false)} onSalvo={() => { setMostrarForm(false); carregarDados() }} />
      )}
    </div>
  )
}

function FormDespesa({ onFechar, onSalvo }: { onFechar: () => void, onSalvo: () => void }) {
  const [form, setForm] = useState({
    descricao: '', categoria: 'combustivel', valor: '', data_despesa: format(new Date(), 'yyyy-MM-dd'), observacoes: ''
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('despesas').insert({ ...form, motorista_id: user!.id, valor: parseFloat(form.valor) })
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Nova despesa</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Categoria</p>
          <div className="grid grid-cols-3 gap-2">
            {categorias.map(c => (
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
            <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              type={f.type} placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        ))}
      </div>

      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <button onClick={salvar} disabled={saving || !form.descricao || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Salvar despesa'}
        </button>
      </div>
    </div>
  )
}
