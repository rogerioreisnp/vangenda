'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  telefone: string | null
  tipo_operacao: string
  plano: string
  status: string
}

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet' }
const STATUS_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function ConfiguracoesEmpresaPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
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

    const { data: emp } = await supabase
      .from('empresas')
      .select('id, nome, telefone, tipo_operacao, plano, status')
      .eq('id', gestor.empresa_id)
      .single()

    if (emp) setEmpresa(emp)
    setLoading(false)
  }

  async function salvar() {
    if (!empresa) return
    if (!empresa.nome.trim()) {
      setErro('Nome da empresa é obrigatório')
      return
    }
    setSaving(true)
    setErro('')

    const { error } = await supabase
      .from('empresas')
      .update({
        nome: empresa.nome.trim(),
        telefone: empresa.telefone?.trim() || null,
        tipo_operacao: empresa.tipo_operacao,
      })
      .eq('id', empresa.id)

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    }
    setSaving(false)
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
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Configurações</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Dados da empresa</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        <Secao titulo="🏢 Dados da empresa">
          <div className="flex flex-col gap-3">
            <Campo label="Nome da empresa *">
              <input
                value={empresa?.nome || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, nome: e.target.value } : emp)}
                placeholder="Nome da empresa"
                className="campo-input"
              />
            </Campo>
            <Campo label="Telefone">
              <input
                value={empresa?.telefone || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, telefone: e.target.value } : emp)}
                placeholder="(XX) XXXXX-XXXX"
                className="campo-input"
              />
            </Campo>
            <Campo label="Modo de operação">
              <select
                value={empresa?.tipo_operacao || 'rota_fixa'}
                onChange={e => setEmpresa(emp => emp ? { ...emp, tipo_operacao: e.target.value } : emp)}
                className="campo-input"
              >
                <option value="transfer">Transfer / Turismo</option>
                <option value="rota_fixa">Rota Fixa Intermunicipal</option>
              </select>
            </Campo>
          </div>
        </Secao>

        <Secao titulo="📋 Plano atual">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {PLANO_LABEL[empresa?.plano || ''] || empresa?.plano}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Plano contratado</p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: empresa?.status === 'ativo' ? '#E1F5EE' : '#FAEEDA',
                color: empresa?.status === 'ativo' ? '#0F6E56' : '#854F0B',
              }}>
              {STATUS_LABEL[empresa?.status || ''] || empresa?.status}
            </span>
          </div>
        </Secao>

        {erro && (
          <div className="rounded-xl px-4 py-3 text-sm border"
            style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
            ⚠️ {erro}
          </div>
        )}

        <button
          onClick={salvar}
          disabled={saving}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : savedMsg ? '✓ Salvo!' : '💾 Salvar alterações'}
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
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="text-sm font-semibold text-gray-700 mb-3">{titulo}</p>
      {children}
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
