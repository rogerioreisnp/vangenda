'use client'
/**
 * Gestao de Clientes (PJ + PF) do transfer empresarial. Fase 2 do projeto
 * vouchers/recibos/relatorios do Julimar.
 *
 * Cliente aqui e apenas DADOS (nome/CNPJ/endereco). Nao ha login pra ele —
 * decisao do Julimar em 2026-07-25 pra manter simples. O que importa e o
 * gestor conseguir cadastrar Hotel Rosewood/Agencia XYZ e no fim do mes
 * filtrar atendimentos por cliente pra cobrar (Fase 4).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  empresa_id: string
  tipo: 'pj' | 'pf'
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  inscricao_estadual: string | null
  nome: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  contato_nome: string | null
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  endereco_cep: string | null
  observacoes: string | null
  ativo: boolean
  criado_em: string
}

const FORM_VAZIO: Omit<Cliente, 'id' | 'empresa_id' | 'criado_em'> = {
  tipo: 'pj',
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  inscricao_estadual: '',
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  contato_nome: '',
  endereco_rua: '',
  endereco_numero: '',
  endereco_bairro: '',
  endereco_cidade: '',
  endereco_estado: '',
  endereco_cep: '',
  observacoes: '',
  ativo: true,
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d
}

function nomeExibicao(c: Cliente): string {
  if (c.tipo === 'pj') return c.nome_fantasia || c.razao_social || 'Sem nome'
  return c.nome || 'Sem nome'
}

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'pj' | 'pf'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<typeof FORM_VAZIO>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .single()
    if (!gestor) { setLoading(false); return }
    setEmpresaId(gestor.empresa_id)
    const { data } = await supabase
      .from('clientes_empresa')
      .select('*')
      .eq('empresa_id', gestor.empresa_id)
      .order('atualizado_em', { ascending: false })
    setClientes((data as Cliente[]) ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }
  function abrirEditar(c: Cliente) {
    setEditando(c)
    setForm({
      tipo: c.tipo,
      razao_social: c.razao_social || '',
      nome_fantasia: c.nome_fantasia || '',
      cnpj: c.cnpj || '',
      inscricao_estadual: c.inscricao_estadual || '',
      nome: c.nome || '',
      cpf: c.cpf || '',
      telefone: c.telefone || '',
      email: c.email || '',
      contato_nome: c.contato_nome || '',
      endereco_rua: c.endereco_rua || '',
      endereco_numero: c.endereco_numero || '',
      endereco_bairro: c.endereco_bairro || '',
      endereco_cidade: c.endereco_cidade || '',
      endereco_estado: c.endereco_estado || '',
      endereco_cep: c.endereco_cep || '',
      observacoes: c.observacoes || '',
      ativo: c.ativo,
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!empresaId) return
    const nomeCheck = form.tipo === 'pj' ? (form.razao_social || form.nome_fantasia) : form.nome
    if (!nomeCheck?.trim()) {
      setErro(form.tipo === 'pj' ? 'Informe pelo menos razão social OU nome fantasia' : 'Informe o nome')
      return
    }
    setSalvando(true)
    setErro('')
    const payload = {
      empresa_id: empresaId,
      tipo: form.tipo,
      razao_social:  form.tipo === 'pj' ? (form.razao_social?.trim()  || null) : null,
      nome_fantasia: form.tipo === 'pj' ? (form.nome_fantasia?.trim() || null) : null,
      cnpj:          form.tipo === 'pj' ? (form.cnpj?.trim()          || null) : null,
      inscricao_estadual: form.tipo === 'pj' ? (form.inscricao_estadual?.trim() || null) : null,
      nome:          form.tipo === 'pf' ? (form.nome?.trim()          || null) : null,
      cpf:           form.tipo === 'pf' ? (form.cpf?.trim()           || null) : null,
      telefone:      form.telefone?.trim()      || null,
      email:         form.email?.trim()         || null,
      contato_nome:  form.contato_nome?.trim()  || null,
      endereco_rua:  form.endereco_rua?.trim()  || null,
      endereco_numero: form.endereco_numero?.trim() || null,
      endereco_bairro: form.endereco_bairro?.trim() || null,
      endereco_cidade: form.endereco_cidade?.trim() || null,
      endereco_estado: form.endereco_estado     || null,
      endereco_cep:  form.endereco_cep?.trim()  || null,
      observacoes:   form.observacoes?.trim()   || null,
      ativo:         form.ativo,
      atualizado_em: new Date().toISOString(),
    }
    const { error } = editando
      ? await supabase.from('clientes_empresa').update(payload).eq('id', editando.id)
      : await supabase.from('clientes_empresa').insert(payload)
    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setModalAberto(false)
    carregar()
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Excluir cliente "${nomeExibicao(c)}"? Atendimentos vinculados a ele ficarão sem cliente vinculado.`)) return
    await supabase.from('clientes_empresa').delete().eq('id', c.id)
    carregar()
  }

  const filtrados = clientes.filter(c => {
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      const campos = [c.razao_social, c.nome_fantasia, c.nome, c.cnpj, c.cpf, c.telefone, c.email].join(' ').toLowerCase()
      if (!campos.includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div className="flex-1 min-w-0">
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Clientes</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Cadastro de clientes PJ e PF pra vincular aos atendimentos</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <button onClick={abrirNovo}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Novo cliente
        </button>

        <div className="flex flex-col gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome, CNPJ, CPF, telefone…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          <div className="flex gap-1.5">
            {([
              { id: 'todos' as const, label: 'Todos' },
              { id: 'pj' as const, label: '🏢 PJ' },
              { id: 'pf' as const, label: '👤 PF' },
            ]).map(f => (
              <button key={f.id} onClick={() => setFiltroTipo(f.id)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                style={filtroTipo === f.id
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#fff', color: '#666', border: '1px solid #e5e7eb' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-4xl mb-2">📇</p>
            <p className="text-sm font-medium text-gray-700">
              {busca.trim() || filtroTipo !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {busca.trim() || filtroTipo !== 'todos' ? 'Ajuste os filtros ou busca.' : 'Toque em "+ Novo cliente" pra começar.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtrados.map(c => {
              const doc = c.tipo === 'pj' ? c.cnpj : c.cpf
              return (
                <div key={c.id} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{c.tipo === 'pj' ? '🏢' : '👤'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{nomeExibicao(c)}</p>
                      {!c.ativo && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          Inativo
                        </span>
                      )}
                    </div>
                    {c.tipo === 'pj' && c.razao_social && c.nome_fantasia && c.razao_social !== c.nome_fantasia && (
                      <p className="text-[11px] text-gray-500 truncate">{c.razao_social}</p>
                    )}
                    {doc && <p className="text-xs text-gray-400 mt-0.5">{c.tipo === 'pj' ? 'CNPJ' : 'CPF'}: {doc}</p>}
                    {(c.telefone || c.email) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[c.telefone, c.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => abrirEditar(c)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => excluir(c)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium"
                      style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setModalAberto(false)}>
          {/* pb-24 garante que o botao "Cadastrar/Salvar" nao fica escondido
              debaixo da bottom nav (safe area) — fix reportado pelo Julimar */}
          <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-24 flex flex-col gap-3" style={{ maxHeight: '92dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-800">{editando ? 'Editar cliente' : 'Novo cliente'}</p>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'pj' as const, label: '🏢 Pessoa Jurídica' },
                { id: 'pf' as const, label: '👤 Pessoa Física' },
              ]).map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                  className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                  style={form.tipo === t.id
                    ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                    : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {form.tipo === 'pj' ? (
              <>
                <Campo label="Razão social">
                  <input value={form.razao_social || ''} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} placeholder="Ex: Hotel Rosewood LTDA" className="campo-input" />
                </Campo>
                <Campo label="Nome fantasia">
                  <input value={form.nome_fantasia || ''} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} placeholder="Ex: Rosewood São Paulo" className="campo-input" />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="CNPJ">
                    <input value={form.cnpj || ''} onChange={e => setForm(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))} placeholder="XX.XXX.XXX/XXXX-XX" className="campo-input" />
                  </Campo>
                  <Campo label="Inscrição Estadual">
                    <input value={form.inscricao_estadual || ''} onChange={e => setForm(f => ({ ...f, inscricao_estadual: e.target.value }))} placeholder="Isento ou nº" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Pessoa de contato (opcional)">
                  <input value={form.contato_nome || ''} onChange={e => setForm(f => ({ ...f, contato_nome: e.target.value }))} placeholder="Ex: Maria Silva — Concierge" className="campo-input" />
                </Campo>
              </>
            ) : (
              <>
                <Campo label="Nome completo">
                  <input value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: João da Silva" className="campo-input" />
                </Campo>
                <Campo label="CPF (opcional)">
                  <input value={form.cpf || ''} onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} placeholder="XXX.XXX.XXX-XX" className="campo-input" />
                </Campo>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Campo label="Telefone">
                <input value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(XX) XXXXX-XXXX" className="campo-input" />
              </Campo>
              <Campo label="Email">
                <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@..." className="campo-input" />
              </Campo>
            </div>

            <details className="mt-1">
              <summary className="text-xs font-semibold text-gray-500 cursor-pointer py-1">📍 Endereço (opcional)</summary>
              <div className="flex flex-col gap-2 mt-2">
                <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <Campo label="Rua"><input value={form.endereco_rua || ''} onChange={e => setForm(f => ({ ...f, endereco_rua: e.target.value }))} className="campo-input" /></Campo>
                  <Campo label="Número"><input value={form.endereco_numero || ''} onChange={e => setForm(f => ({ ...f, endereco_numero: e.target.value }))} className="campo-input" /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Bairro"><input value={form.endereco_bairro || ''} onChange={e => setForm(f => ({ ...f, endereco_bairro: e.target.value }))} className="campo-input" /></Campo>
                  <Campo label="CEP"><input value={form.endereco_cep || ''} onChange={e => setForm(f => ({ ...f, endereco_cep: maskCEP(e.target.value) }))} className="campo-input" /></Campo>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <Campo label="Cidade"><input value={form.endereco_cidade || ''} onChange={e => setForm(f => ({ ...f, endereco_cidade: e.target.value }))} className="campo-input" /></Campo>
                  <Campo label="UF">
                    <select value={form.endereco_estado || ''} onChange={e => setForm(f => ({ ...f, endereco_estado: e.target.value }))} className="campo-input">
                      <option value="">--</option>
                      {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </Campo>
                </div>
              </div>
            </details>

            <Campo label="Observações (opcional)">
              <textarea rows={2} value={form.observacoes || ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Ex: prefere pagamento por boleto, faturamento no dia 15..." className="campo-input" style={{ resize: 'vertical' }} />
            </Campo>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
              Cliente ativo
            </label>

            {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3 rounded-xl text-white text-sm font-bold mt-1 disabled:opacity-40"
              style={{ background: '#0F6E56' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .campo-input { width: 100%; padding: 0.55rem 0.75rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; background: #fff; font-size: 0.85rem; outline: none; }
        .campo-input:focus { border-color: #0F6E56; }
      `}</style>
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
