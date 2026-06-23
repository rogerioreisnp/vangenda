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
  cnpj: string | null
  email_comercial: string | null
  cidade: string | null
  estado: string | null
  qtd_veiculos: number | null
  descricao: string | null
  chave_pix: string | null
  tipo_chave_pix: string | null
  instagram: string | null
  whatsapp_comercial: string | null
  cor_destaque: string | null
  logo_url: string | null
  trial_fim: string | null
  slug: string | null
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
      .select('id, nome, telefone, tipo_operacao, plano, status, cnpj, email_comercial, cidade, estado, qtd_veiculos, descricao, chave_pix, tipo_chave_pix, instagram, whatsapp_comercial, cor_destaque, logo_url, trial_fim, slug')
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
        cnpj: empresa.cnpj?.trim() || null,
        email_comercial: empresa.email_comercial?.trim() || null,
        cidade: empresa.cidade?.trim() || null,
        estado: empresa.estado || null,
        qtd_veiculos: empresa.qtd_veiculos ?? null,
        descricao: empresa.descricao?.trim() || null,
        chave_pix: empresa.chave_pix?.trim() || null,
        tipo_chave_pix: empresa.tipo_chave_pix || 'telefone',
        instagram: empresa.instagram?.trim() || null,
        whatsapp_comercial: empresa.whatsapp_comercial?.trim() || null,
        cor_destaque: empresa.cor_destaque || '#1D9E75',
        logo_url: empresa.logo_url?.trim() || null,
        slug: empresa.slug?.trim() || null,
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
            <Campo label="CNPJ (opcional)">
              <input
                value={empresa?.cnpj || ''}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 14)
                  const mask = v.length <= 2 ? v
                    : v.length <= 5 ? `${v.slice(0,2)}.${v.slice(2)}`
                    : v.length <= 8 ? `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`
                    : v.length <= 12 ? `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`
                    : `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`
                  setEmpresa(emp => emp ? { ...emp, cnpj: mask } : emp)
                }}
                placeholder="XX.XXX.XXX/XXXX-XX"
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
            <Campo label="E-mail comercial">
              <input
                type="email"
                value={empresa?.email_comercial || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, email_comercial: e.target.value } : emp)}
                placeholder="contato@suaempresa.com"
                className="campo-input"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Cidade">
                <input
                  value={empresa?.cidade || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, cidade: e.target.value } : emp)}
                  placeholder="Ex: Manaus"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Estado">
                <select
                  value={empresa?.estado || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, estado: e.target.value } : emp)}
                  className="campo-input"
                >
                  <option value="">UF</option>
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo label="Quantidade de veículos">
              <input
                type="number"
                min={0}
                value={empresa?.qtd_veiculos ?? ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, qtd_veiculos: e.target.value ? parseInt(e.target.value) : null } : emp)}
                placeholder="Ex: 5"
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
            <div className="flex items-center justify-between pt-2"
              style={{ borderTop: '1px solid #f5f5f5', marginTop: '4px' }}>
              <div>
                <p className="text-xs text-gray-400">Plano contratado</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  {PLANO_LABEL[empresa?.plano || ''] || empresa?.plano}
                </p>
                {empresa?.status === 'trial' && empresa?.trial_fim && (
                  <p className="text-xs mt-0.5" style={{ color: '#854F0B' }}>
                    Trial até {empresa.trial_fim.slice(8, 10)}/{empresa.trial_fim.slice(5, 7)}/{empresa.trial_fim.slice(0, 4)}
                  </p>
                )}
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
          </div>
        </Secao>

        <Secao titulo="🎨 Personalização">
          <div className="flex flex-col gap-3">
            <Campo label="Descrição curta">
              <textarea
                value={empresa?.descricao || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, descricao: e.target.value } : emp)}
                placeholder="Ex: Transfer executivo no Rio de Janeiro"
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Chave Pix">
                <input
                  value={empresa?.chave_pix || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, chave_pix: e.target.value } : emp)}
                  placeholder="Sua chave Pix"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Tipo da chave">
                <select
                  value={empresa?.tipo_chave_pix || 'telefone'}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, tipo_chave_pix: e.target.value } : emp)}
                  className="campo-input"
                >
                  <option value="telefone">Telefone</option>
                  <option value="cpf_cnpj">CPF/CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="aleatoria">Aleatória</option>
                </select>
              </Campo>
            </div>
            <Campo label="WhatsApp comercial">
              <input
                value={empresa?.whatsapp_comercial || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, whatsapp_comercial: e.target.value } : emp)}
                placeholder="(XX) XXXXX-XXXX"
                className="campo-input"
              />
            </Campo>
            <Campo label="Instagram">
              <input
                value={empresa?.instagram || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, instagram: e.target.value } : emp)}
                placeholder="@suaempresa"
                className="campo-input"
              />
            </Campo>
            <Campo label="Cor de destaque">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={empresa?.cor_destaque || '#1D9E75'}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, cor_destaque: e.target.value } : emp)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  style={{ background: '#fff' }}
                />
                <span className="text-sm text-gray-500 font-mono">
                  {empresa?.cor_destaque || '#1D9E75'}
                </span>
              </div>
            </Campo>
            <Campo label="Logo da empresa (URL)">
              <input
                value={empresa?.logo_url || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, logo_url: e.target.value } : emp)}
                placeholder="Cole o link da sua logo"
                className="campo-input"
              />
              {empresa?.logo_url && (
                <img
                  src={empresa.logo_url}
                  alt="Logo"
                  className="mt-2 h-12 object-contain rounded"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </Campo>
            <Campo label="Link personalizado">
              <input
                value={empresa?.slug || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : emp)}
                placeholder="ex: transfer-rio"
                className="campo-input"
              />
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                ℹ️ Esse é o endereço exclusivo do seu app. Seus clientes vão usar esse link para agendar corridas diretamente com sua empresa. Use um nome curto e fácil de lembrar. Exemplo: minha-empresa, turismo-express
              </p>
              {empresa?.slug && (
                <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
                  Seu link será:{' '}
                  <span className="font-medium" style={{ color: '#0F6E56' }}>
                    {window.location.origin}/agendar/{empresa.slug}
                  </span>
                </p>
              )}
              {!empresa?.slug && (
                <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>
                  Seu link será: {window.location.origin}/agendar/[slug]
                </p>
              )}
            </Campo>
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
