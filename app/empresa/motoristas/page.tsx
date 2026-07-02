'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Motorista = {
  id: string
  user_id: string | null
  nome: string
  telefone: string | null
  veiculo: string | null
  placa: string | null
  cor: string | null
  status: string
}

type FormMotorista = {
  nome: string
  email: string
  senha: string
  telefone: string
  veiculo: string
  placa: string
  cor: string
}

export default function MotoristasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Motorista | null>(null)
  const [form, setForm] = useState<FormMotorista>({ nome: '', email: '', senha: '', telefone: '', veiculo: '', placa: '', cor: '' })
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
      .select('id')
      .eq('id', gestor.empresa_id)
      .single()

    if (!empresa) return

    setEmpresaId(empresa.id)

    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('id, user_id, nome, telefone, veiculo, placa, cor, status')
      .eq('empresa_id', empresa.id)
      .order('created_at')

    if (mots) setMotoristas(mots)
    setLoading(false)
  }

  function abrirAdicionar() {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', telefone: '', veiculo: '', placa: '', cor: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(m: Motorista) {
    setEditando(m)
    setForm({ nome: m.nome, email: '', senha: '', telefone: m.telefone || '', veiculo: m.veiculo || '', placa: m.placa || '', cor: m.cor || '' })
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
        if (form.senha && form.senha.length < 6) {
          setErro('A nova senha deve ter no mínimo 6 caracteres')
          return
        }

        const { error } = await supabase
          .from('motoristas_empresa')
          .update({
            nome: form.nome.trim(),
            telefone: form.telefone.trim() || null,
            veiculo: form.veiculo.trim() || null,
            placa: form.placa.trim() || null,
            cor: form.cor.trim() || null,
          })
          .eq('id', editando.id)

        if (error) { setErro('Erro ao salvar: ' + error.message); return }

        if (form.email.trim() || form.senha) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setErro('Sessão expirada. Recarregue a página.'); return }

          const res = await fetch('/api/empresa/motoristas/atualizar', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              motoristaEmpresaId: editando.id,
              novoEmail: form.email.trim() || undefined,
              novaSenha: form.senha || undefined,
            }),
          })

          const json = await res.json()
          if (!res.ok) { setErro(json.error || 'Erro ao atualizar credenciais'); return }
        }
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
            cor: form.cor.trim() || null,
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
        <div className="animate-pulse">
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    )
  }

  const motAtivos = motoristas.filter(m => m.status === 'ativo')
  const motInativos = motoristas.filter(m => m.status === 'inativo')

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Motoristas</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {motAtivos.length} ativo{motAtivos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        <button
          onClick={abrirAdicionar}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Adicionar motorista
        </button>

        {motAtivos.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <svg width="48" height="48" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-2 mx-auto">
              <rect width="192" height="192" rx="42" fill="#04342C"/>
              <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
              <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
              <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
              <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
            </svg>
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
                    {(m.veiculo || m.placa || m.cor) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[m.veiculo, m.cor, m.placa].filter(Boolean).join(' · ')}
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
                      onClick={() => ativar(m.id)}
                      title="Reativar motorista"
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium"
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

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 flex flex-col gap-3">
            <Campo label="Nome *">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            <Campo label={editando ? 'Novo e-mail' : 'E-mail de acesso *'}>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={editando ? 'Deixe em branco para manter o atual' : 'motorista@email.com'}
                type="email" className="campo-input" />
            </Campo>

            <Campo label={editando ? 'Nova senha' : 'Senha provisória *'}>
              <input value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder={editando ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'}
                type="password" className="campo-input" />
            </Campo>

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
            <Campo label="Cor do veículo">
              <input value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                placeholder="Ex: Preto, Branco, Prata" className="campo-input" />
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
