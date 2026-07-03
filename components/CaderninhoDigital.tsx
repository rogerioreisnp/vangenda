'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getMotoristaIdSalvar } from '@/lib/motorista-salvar'

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type Mov = {
  id: string
  tipo: 'divida' | 'pagamento'
  valor: number
  descricao: string | null
  created_at: string
}

type ClienteResumo = {
  nome: string
  saldo: number
  totalDivida: number
  totalPago: number
  ultimoLancamento: string
  qtdMovs: number
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const CORES = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#14B8A6']

function corAvatar(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h)
  return CORES[Math.abs(h) % CORES.length]
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '?'
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── LISTA DE CLIENTES ────────────────────────────────────────────────────────

function ListaClientes({
  categoria,
  onSelect,
}: {
  categoria: 'fiado' | 'encomenda'
  onSelect: (nome: string) => void
}) {
  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', descricao: '', valor: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [categoria])

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('movimentacoes')
      .select('cliente_nome, tipo, valor, created_at')
      .eq('motorista_id', user.id)
      .eq('categoria', categoria)

    if (!data) { setLoading(false); return }

    const map: Record<string, ClienteResumo> = {}
    for (const m of data) {
      if (!map[m.cliente_nome]) {
        map[m.cliente_nome] = {
          nome: m.cliente_nome,
          saldo: 0, totalDivida: 0, totalPago: 0,
          ultimoLancamento: m.created_at, qtdMovs: 0,
        }
      }
      const c = map[m.cliente_nome]
      if (m.tipo === 'divida') c.totalDivida += m.valor
      else c.totalPago += m.valor
      c.qtdMovs++
      if (m.created_at > c.ultimoLancamento) c.ultimoLancamento = m.created_at
    }

    const lista = Object.values(map)
      .map(c => ({ ...c, saldo: c.totalDivida - c.totalPago }))
      .filter(c => c.saldo > 0.001)
      .sort((a, b) => b.saldo - a.saldo)

    setClientes(lista)
    setLoading(false)
  }

  const totalGeral = clientes.reduce((s, c) => s + c.saldo, 0)

  async function salvarNovaDivida() {
    if (!form.nome.trim() || !form.descricao.trim()) { setErro('Preencha nome e descrição.'); return }
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('movimentacoes').insert({
      motorista_id: await getMotoristaIdSalvar(user.id),
      cliente_nome: form.nome.trim(),
      tipo: 'divida',
      valor,
      descricao: form.descricao.trim(),
      categoria,
    })

    setSaving(false)
    if (error) { setErro('Erro ao salvar.'); return }
    setForm({ nome: '', descricao: '', valor: '' })
    setModalNovo(false)
    await carregar()
  }

  return (
    <div style={{ background: '#0f1117', minHeight: '100%' }} className="px-4 py-4 pb-28">

      {/* Badge total em aberto */}
      {totalGeral > 0 && (
        <div className="mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2"
          style={{ background: 'rgba(240,149,149,0.12)', border: '1px solid rgba(240,149,149,0.2)' }}>
          <span className="text-sm">💰</span>
          <span className="text-sm font-semibold" style={{ color: '#f09595' }}>
            R$ {brl(totalGeral)} em aberto
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <p className="text-3xl animate-pulse">⏳</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Nenhum {categoria === 'fiado' ? 'fiado' : 'encomenda'} em aberto
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Toque em + para registrar uma dívida
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {clientes.map((c, i) => {
            const cor = corAvatar(c.nome)
            return (
              <button key={c.nome} onClick={() => onSelect(c.nome)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                style={{
                  background: '#1a1d27',
                  borderBottom: i < clientes.length - 1
                    ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: cor + '22', border: `1.5px solid ${cor}55`, color: cor }}>
                  {iniciais(c.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                    {c.nome}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {c.qtdMovs} lançamento{c.qtdMovs !== 1 ? 's' : ''} ·{' '}
                    {format(new Date(c.ultimoLancamento), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: '#f09595' }}>
                    R$ {brl(c.saldo)}
                  </p>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, lineHeight: 1 }}>›</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* FAB novo lançamento */}
      <button
        onClick={() => { setModalNovo(true); setForm({ nome: '', descricao: '', valor: '' }); setErro('') }}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg active:opacity-70"
        style={{ background: '#f09595', color: '#fff' }}>
        +
      </button>

      {/* Modal nova dívida */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNovo(false) }}>
          <div className="w-full rounded-t-2xl p-5 pb-10" style={{ background: '#1a1d27' }}>
            <p className="text-base font-bold mb-4" style={{ color: '#fff' }}>Nova dívida</p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Nome do cliente
                </p>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Descrição
                </p>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder={categoria === 'fiado' ? 'Ex: Passagem fiada' : 'Ex: Encomenda Correios'}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Valor (R$)
                </p>
                <input
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {erro && <p className="text-xs" style={{ color: '#f09595' }}>{erro}</p>}
              <button
                onClick={salvarNovaDivida}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-sm font-bold mt-1 disabled:opacity-50 active:opacity-70"
                style={{ background: 'rgba(240,149,149,0.2)', color: '#f09595', border: '1px solid rgba(240,149,149,0.3)' }}>
                {saving ? 'Salvando...' : 'Confirmar dívida'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EXTRATO DO CLIENTE ───────────────────────────────────────────────────────

function ExtratoCliente({
  categoria,
  clienteNome,
  onVoltar,
}: {
  categoria: 'fiado' | 'encomenda'
  clienteNome: string
  onVoltar: () => void
}) {
  const [movs, setMovs] = useState<Mov[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'divida' | 'baixa' | null>(null)
  const [form, setForm] = useState({ descricao: '', valor: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [movEditando, setMovEditando] = useState<Mov | null>(null)
  const [movExcluindo, setMovExcluindo] = useState<Mov | null>(null)

  useEffect(() => { carregar() }, [clienteNome, categoria])

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('movimentacoes')
      .select('id, tipo, valor, descricao, created_at')
      .eq('motorista_id', user.id)
      .eq('categoria', categoria)
      .eq('cliente_nome', clienteNome)
      .order('created_at', { ascending: true })

    if (data) setMovs(data)
    setLoading(false)
  }

  const totalDivida = movs.filter(m => m.tipo === 'divida').reduce((s, m) => s + m.valor, 0)
  const totalPago   = movs.filter(m => m.tipo === 'pagamento').reduce((s, m) => s + m.valor, 0)
  const saldo       = totalDivida - totalPago

  async function adicionarDivida() {
    if (!form.descricao.trim()) { setErro('Informe a descrição.'); return }
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('movimentacoes').insert({
      motorista_id: await getMotoristaIdSalvar(user.id),
      cliente_nome: clienteNome,
      tipo: 'divida',
      valor,
      descricao: form.descricao.trim(),
      categoria,
    })

    setSaving(false)
    if (error) { setErro('Erro ao salvar.'); return }
    setForm({ descricao: '', valor: '' })
    setModal(null)
    await carregar()
  }

  async function darBaixa() {
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }
    if (valor > saldo + 0.01) { setErro(`Valor maior que o saldo (R$ ${brl(saldo)}).`); return }
    setSaving(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('movimentacoes').insert({
        motorista_id: await getMotoristaIdSalvar(user.id),
        cliente_nome: clienteNome,
        tipo: 'pagamento',
        valor,
        descricao: 'Pagamento recebido',
        categoria,
      }),
      supabase.from('receitas').insert({
        motorista_id: await getMotoristaIdSalvar(user.id),
        descricao: `${categoria === 'fiado' ? 'Recebimento fiado' : 'Recebimento encomenda'} — ${clienteNome}`,
        categoria: categoria === 'fiado' ? 'passagens_avulsas' : 'entrega',
        valor,
        data_receita: format(new Date(), 'yyyy-MM-dd'),
      }),
    ])

    setSaving(false)
    if (e1 || e2) { setErro('Erro ao registrar pagamento.'); return }
    setForm({ descricao: '', valor: '' })
    setModal(null)

    if (saldo - valor <= 0.01) {
      onVoltar()
    } else {
      await carregar()
    }
  }

  async function editarMov() {
    if (!movEditando) return
    if (!form.descricao.trim()) { setErro('Informe a descrição.'); return }
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }
    setSaving(true); setErro('')

    const { error } = await supabase
      .from('movimentacoes')
      .update({ descricao: form.descricao.trim(), valor })
      .eq('id', movEditando.id)

    setSaving(false)
    if (error) { setErro('Erro ao editar.'); return }
    setMovEditando(null)
    setForm({ descricao: '', valor: '' })
    await carregar()
  }

  async function excluirMov() {
    if (!movExcluindo) return
    setSaving(true)

    const { error } = await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', movExcluindo.id)

    setSaving(false)
    if (error) { setMovExcluindo(null); return }

    const novasMovs = movs.filter(m => m.id !== movExcluindo.id)
    const novoSaldo = novasMovs.filter(m => m.tipo === 'divida').reduce((s, m) => s + m.valor, 0)
                   - novasMovs.filter(m => m.tipo === 'pagamento').reduce((s, m) => s + m.valor, 0)

    setMovExcluindo(null)
    if (novoSaldo <= 0.001 || novasMovs.length === 0) {
      onVoltar()
    } else {
      await carregar()
    }
  }

  const cor = corAvatar(clienteNome)

  return (
    <div style={{ background: '#0f1117', minHeight: '100%' }} className="flex flex-col">

      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={onVoltar}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xl active:opacity-70"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#fff' }}>
          ‹
        </button>
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
          style={{ background: cor + '22', border: `1.5px solid ${cor}55`, color: cor }}>
          {iniciais(clienteNome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{clienteNome}</p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {movs.length} lançamento{movs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Barra de resumo */}
      <div className="mx-4 mt-4 rounded-xl overflow-hidden"
        style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid grid-cols-3">
          {([
            { label: 'Cobrado',  valor: totalDivida, cor: '#f09595' },
            { label: 'Recebido', valor: totalPago,   cor: '#5dcaa5' },
            { label: 'Saldo',    valor: saldo,       cor: '#fac775' },
          ] as const).map((item, i) => (
            <div key={item.label} className="px-2 py-3 text-center"
              style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <p className="text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {item.label}
              </p>
              <p className="text-sm font-bold" style={{ color: item.cor }}>
                R$ {brl(item.valor)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico */}
      <div className="flex-1 px-4 pt-4 pb-36 overflow-y-auto">
        <p className="text-[10px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Histórico
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-2xl animate-pulse">⏳</p>
          </div>
        ) : movs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Nenhum lançamento
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {movs.map(m => {
              const isDivida = m.tipo === 'divida'
              return (
                <div key={m.id} className="flex items-center gap-2 px-3 py-3 rounded-xl"
                  style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div
                    className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm"
                    style={{ background: isDivida ? 'rgba(226,75,74,0.15)' : 'rgba(29,158,117,0.15)' }}>
                    {isDivida ? (categoria === 'fiado' ? '💳' : '📦') : '💵'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate"
                      style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {m.descricao || (isDivida ? 'Dívida' : 'Pagamento')}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {format(new Date(m.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold flex-shrink-0"
                    style={{ color: isDivida ? '#f09595' : '#5dcaa5' }}>
                    {isDivida ? '+' : '−'} R$ {brl(m.valor)}
                  </p>
                  <button
                    onClick={() => { setMovEditando(m); setForm({ descricao: m.descricao || '', valor: String(m.valor) }); setErro('') }}
                    className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center active:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setMovExcluindo(m)}
                    className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center active:opacity-60"
                    style={{ background: 'rgba(226,75,74,0.12)', color: '#f09595' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Botões de ação */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 flex gap-3"
        style={{ background: 'linear-gradient(to top, #0f1117 75%, transparent)' }}>
        <button
          onClick={() => { setModal('divida'); setForm({ descricao: '', valor: '' }); setErro('') }}
          className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-70"
          style={{ background: 'rgba(226,75,74,0.18)', color: '#f09595', border: '1px solid rgba(226,75,74,0.3)' }}>
          + Adicionar dívida
        </button>
        {saldo > 0.01 && (
          <button
            onClick={() => { setModal('baixa'); setForm({ descricao: '', valor: '' }); setErro('') }}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-70"
            style={{ background: 'rgba(29,158,117,0.18)', color: '#5dcaa5', border: '1px solid rgba(29,158,117,0.3)' }}>
            ✓ Dar baixa
          </button>
        )}
      </div>

      {/* Modal Adicionar Dívida */}
      {modal === 'divida' && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="w-full rounded-t-2xl p-5 pb-10" style={{ background: '#1a1d27' }}>
            <p className="text-base font-bold mb-4" style={{ color: '#fff' }}>Adicionar dívida</p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Descrição
                </p>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder={categoria === 'fiado' ? 'Ex: Passagem fiada' : 'Ex: Encomenda Correios'}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Valor (R$)
                </p>
                <input
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {erro && <p className="text-xs" style={{ color: '#f09595' }}>{erro}</p>}
              <button
                onClick={adicionarDivida}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-sm font-bold mt-1 disabled:opacity-50 active:opacity-70"
                style={{ background: 'rgba(226,75,74,0.2)', color: '#f09595', border: '1px solid rgba(226,75,74,0.3)' }}>
                {saving ? 'Salvando...' : 'Confirmar dívida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar lançamento */}
      {movEditando && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setMovEditando(null) }}>
          <div className="w-full rounded-t-2xl p-5 pb-10" style={{ background: '#1a1d27' }}>
            <p className="text-base font-bold mb-4" style={{ color: '#fff' }}>Editar lançamento</p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Descrição
                </p>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Valor (R$)
                </p>
                <input
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  inputMode="decimal"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {erro && <p className="text-xs" style={{ color: '#f09595' }}>{erro}</p>}
              <button
                onClick={editarMov}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-sm font-bold mt-1 disabled:opacity-50 active:opacity-70"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {movExcluindo && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setMovExcluindo(null) }}>
          <div className="w-full rounded-t-2xl p-5 pb-10" style={{ background: '#1a1d27' }}>
            <p className="text-base font-bold mb-1" style={{ color: '#fff' }}>Excluir lançamento</p>
            <p className="text-sm mb-1 mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {movExcluindo.descricao || (movExcluindo.tipo === 'divida' ? 'Dívida' : 'Pagamento')}
            </p>
            <p className="text-sm font-semibold mb-5"
              style={{ color: movExcluindo.tipo === 'divida' ? '#f09595' : '#5dcaa5' }}>
              R$ {brl(movExcluindo.valor)}
            </p>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMovExcluindo(null)}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:opacity-70"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancelar
              </button>
              <button
                onClick={excluirMov}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 active:opacity-70"
                style={{ background: 'rgba(226,75,74,0.2)', color: '#f09595', border: '1px solid rgba(226,75,74,0.3)' }}>
                {saving ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dar Baixa */}
      {modal === 'baixa' && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="w-full rounded-t-2xl p-5 pb-10" style={{ background: '#1a1d27' }}>
            <p className="text-base font-bold mb-1" style={{ color: '#fff' }}>Dar baixa</p>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Saldo atual:{' '}
              <span style={{ color: '#fac775', fontWeight: 600 }}>R$ {brl(saldo)}</span>
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Valor recebido (R$)
                </p>
                <input
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder={brl(saldo)}
                  inputMode="decimal"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {erro && <p className="text-xs" style={{ color: '#f09595' }}>{erro}</p>}
              <button
                onClick={darBaixa}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-sm font-bold mt-1 disabled:opacity-50 active:opacity-70"
                style={{ background: 'rgba(29,158,117,0.2)', color: '#5dcaa5', border: '1px solid rgba(29,158,117,0.3)' }}>
                {saving ? 'Salvando...' : 'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EXPORT PRINCIPAL ────────────────────────────────────────────────────────

export default function CaderninhoDigital({ categoria }: { categoria: 'fiado' | 'encomenda' }) {
  const [view, setView] = useState<'lista' | 'extrato'>('lista')
  const [cliente, setCliente] = useState<string | null>(null)

  if (view === 'extrato' && cliente) {
    return (
      <ExtratoCliente
        categoria={categoria}
        clienteNome={cliente}
        onVoltar={() => { setView('lista'); setCliente(null) }}
      />
    )
  }

  return (
    <ListaClientes
      categoria={categoria}
      onSelect={nome => { setCliente(nome); setView('extrato') }}
    />
  )
}
