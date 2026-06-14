'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Rota = {
  id: string
  origem: string
  destino: string
  distancia_km: number | null
  preco: number
}

type FormRota = {
  origem: string
  destino: string
  distancia_km: string
  preco: string
}

export default function RotasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Rota | null>(null)
  const [form, setForm] = useState<FormRota>({ origem: '', destino: '', distancia_km: '', preco: '' })
  const [salvando, setSalvando] = useState(false)
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

    setEmpresaId(gestor.empresa_id)

    const { data: rts } = await supabase
      .from('rotas_empresa')
      .select('id, origem, destino, distancia_km, preco')
      .eq('empresa_id', gestor.empresa_id)
      .order('created_at')

    if (rts) setRotas(rts)
    setLoading(false)
  }

  function abrirAdicionar() {
    setEditando(null)
    setForm({ origem: '', destino: '', distancia_km: '', preco: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(r: Rota) {
    setEditando(r)
    setForm({
      origem: r.origem,
      destino: r.destino,
      distancia_km: r.distancia_km != null ? String(r.distancia_km) : '',
      preco: String(r.preco),
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.origem.trim() || !form.destino.trim()) {
      setErro('Origem e destino são obrigatórios')
      return
    }
    const preco = parseFloat(form.preco)
    if (isNaN(preco) || preco < 0) {
      setErro('Preço inválido')
      return
    }
    if (!empresaId) return
    setSalvando(true)
    setErro('')

    const payload = {
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      distancia_km: form.distancia_km.trim() ? parseInt(form.distancia_km) || null : null,
      preco,
    }

    if (editando) {
      const { error } = await supabase
        .from('rotas_empresa')
        .update(payload)
        .eq('id', editando.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('rotas_empresa')
        .insert({ ...payload, empresa_id: empresaId })

      if (error) {
        setErro('Erro ao adicionar: ' + error.message)
        setSalvando(false)
        return
      }
    }

    setSalvando(false)
    setModalAberto(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('rotas_empresa').delete().eq('id', id)
    setRotas(prev => prev.filter(r => r.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Rotas</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {rotas.length} rota{rotas.length !== 1 ? 's' : ''} cadastrada{rotas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        <button
          onClick={abrirAdicionar}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Adicionar rota
        </button>

        {rotas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">🛣️</p>
            <p className="text-sm text-gray-500">Nenhuma rota cadastrada ainda.</p>
            <p className="text-xs text-gray-400 mt-1">As rotas serão usadas para pré-preencher valores no agendamento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rotas.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {r.origem} → {r.destino}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {Number(r.preco).toFixed(2).replace('.', ',')}
                      </p>
                      {r.distancia_km != null && (
                        <p className="text-xs text-gray-400">{r.distancia_km} km</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(r)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      Editar
                    </button>
                    <button
                      onClick={() => excluir(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                {editando ? 'Editar rota' : 'Nova rota'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <Campo label="Origem *">
              <input value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                placeholder="Ex: Aeroporto de Manaus" className="campo-input" />
            </Campo>
            <Campo label="Destino *">
              <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                placeholder="Ex: Hotel Tropical" className="campo-input" />
            </Campo>
            <Campo label="Distância (km) — opcional">
              <input type="number" value={form.distancia_km}
                onChange={e => setForm(f => ({ ...f, distancia_km: e.target.value }))}
                placeholder="Ex: 25" className="campo-input" min={0} />
            </Campo>
            <Campo label="Preço (R$) *">
              <input type="number" step="0.01" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                placeholder="Ex: 150.00" className="campo-input" min={0} />
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
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar rota'}
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
