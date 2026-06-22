'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Motorista = {
  id: string
  nome: string
  telefone: string | null
  veiculo: string | null
  placa: string | null
  status: string
}

type FormMotorista = {
  nome: string
  email: string
  senha: string
  telefone: string
  veiculo: string
  placa: string
}

const LIMITES_PLANO: Record<string, number> = {
  starter: 3,
  pro: 8,
  fleet: Infinity,
}

export default function MotoristasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [plano, setPlano] = useState<string>('starter')
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Motorista | null>(null)
  const [form, setForm] = useState<FormMotorista>({ nome: '', email: '', senha: '', telefone: '', veiculo: '', placa: '' })
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, plano')
      .eq('id', gestor.empresa_id)
      .single()

    if (!empresa) return

    setEmpresaId(empresa.id)
    setPlano(empresa.plano)

    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('id, nome, telefone, veiculo, placa, status')
      .eq('empresa_id', empresa.id)
      .order('created_at')

    if (mots) setMotoristas(mots)
    setLoading(false)
  }

  function abrirAdicionar() {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', telefone: '', veiculo: '', placa: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(m: Motorista) {
    setEditando(m)
    setForm({ nome: m.nome, email: '', senha: '', telefone: m.telefone || '', veiculo: m.veiculo || '', placa: m.placa || '' })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (salvandoRef.current) return // guard contra double-fire antes do re-render
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!empresaId) return

    salvandoRef.current = true
    setSalvando(true)
    setErro('')

    try {
      if (editando) {
        const { error } = await supabase
          .from('motoristas_empresa')
          .update({
            nome: form.nome.trim(),
            telefone: form.telefone.trim() || null,
            veiculo: form.veiculo.trim() || null,
            placa: form.placa.trim() || null,
          })
          .eq('id', editando.id)

        if (error) { setErro('Erro ao salvar: ' + error.message); return }
      } else {
        if (!form.email.trim()) { setErro('E-mail é obrigatório'); return }
        if (!form.senha) { setErro('Senha é obrigatória'); return }
        if (form.senha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres'); return }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setErro('Sessão expirada. Recarregue a página.'); return }

        const res = await fetch('/api/empresa/motoristas/criar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nome: form.nome.trim(),
            email: form.email.trim(),
            senha: form.senha,
            telefone: form.telefone.trim() || null,
            veiculo: form.veiculo.trim() || null,
            placa: form.placa.trim() || null,
          }),
        })

        const json = await res.json()
        if (!res.ok) { setErro(json.error || 'Erro ao adicionar motorista'); return }
      }

      setModalAberto(false)
      carregarDados()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  async function inativar(id: string) {
    await supabase
      .from('motoristas_empresa')
      .update({ status: 'inativo' })
      .eq('id', id)
    carregarDados()
  }

  async function ativar(id: string) {
    await supabase
      .from('motoristas_empresa')
      .update({ status: 'ativo' })
      .eq('id', id)
    carregarDados()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  const motAtivos = motoristas.filter(m => m.status === 'ativo')
  const motInativos = motoristas.filter(m => m.status === 'inativo')
  const limite = LIMITES_PLANO[plano] ?? 3
  const atingiuLimite = motAtivos.length >= limite

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Motoristas</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {motAtivos.length}{limite !== Infinity ? `/${limite}` : ''} ativo{motAtivos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {atingiuLimite ? (
          <div className="rounded-xl px-4 py-3 text-sm border"
            style={{ background: '#FAEEDA', borderColor: '#FAC775', color: '#854F0B' }}>
            ⚠️ Limite do plano atingido. Faça upgrade para adicionar mais motoristas.
          </div>
        ) : (
          <button
            onClick={abrirAdicionar}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#1D9E75', color: '#fff' }}>
            + Adicionar motorista
          </button>
        )}

        {motAtivos.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">🚐</p>
            <p className="text-sm text-gray-500">Nenhum motorista cadastrado ainda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {motAtivos.map(m => (
              <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{m.nome}</p>
                    {m.telefone && (
                      <p className="text-xs text-gray-400 mt-0.5">{m.telefone}</p>
                    )}
                    {(m.veiculo || m.placa) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[m.veiculo, m.placa].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(m)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      Editar
                    </button>
                    <button
                      onClick={() => inativar(m.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                      Inativar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {motInativos.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Inativos</p>
            <div className="flex flex-col gap-2">
              {motInativos.map(m => (
                <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100 opacity-70">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-500">{m.nome}</p>
                      {m.telefone && <p className="text-xs text-gray-400 mt-0.5">{m.telefone}</p>}
                      {(m.veiculo || m.placa) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[m.veiculo, m.placa].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => !atingiuLimite && ativar(m.id)}
                      disabled={atingiuLimite}
                      title={atingiuLimite ? 'Limite do plano atingido' : 'Reativar motorista'}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      Reativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                {editando ? 'Editar motorista' : 'Novo motorista'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <Campo label="Nome *">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            {!editando && (
              <>
                <Campo label="E-mail de acesso *">
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="motorista@email.com" type="email" className="campo-input" />
                </Campo>
                <Campo label="Senha provisória *">
                  <input value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                    placeholder="Mínimo 6 caracteres" type="password" className="campo-input" />
                </Campo>
              </>
            )}

            <Campo label="Telefone">
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" className="campo-input" />
            </Campo>
            <Campo label="Veículo">
              <input value={form.veiculo} onChange={e => setForm(f => ({ ...f, veiculo: e.target.value }))}
                placeholder="Ex: Van Sprinter" className="campo-input" />
            </Campo>
            <Campo label="Placa">
              <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))}
                placeholder="Ex: ABC-1234" className="campo-input" />
            </Campo>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-2 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar motorista'}
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
