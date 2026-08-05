'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  telefone: string | null
  tipo_operacao: string
  periodo: string | null
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
  transfer_numero_inicio: number | null
  mensagem_confirmacao: string | null
  mensagem_confirmacao_transfer: string | null
  // Fase 1 cadastro fiscal — usados nos vouchers/recibos
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cep: string | null
  inscricao_estadual: string | null
  site: string | null
  banco_nome: string | null
  banco_agencia: string | null
  banco_conta: string | null
  banco_tipo_conta: string | null
  banco_titular_nome: string | null
  banco_titular_documento: string | null
  // Minutos de antecedencia do lembrete pre-atendimento (0 = desativado)
  minutos_antes_lembrete: number | null
  // Horas apos o atendimento pra alertar pagamento Pix/Dinheiro/Cartao ainda
  // pendente (0 = desativado)
  horas_apos_atendimento_cobranca: number | null
}

// Planos vendidos hoje: Mensal, Semestral e Anual (mudam só o período de
// cobrança). Os rótulos antigos Starter/Pro/Fleet não existem mais.
const PERIODO_LABEL: Record<string, string> = { mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual' }
const STATUS_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function ConfiguracoesEmpresaPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoErro, setLogoErro] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [erro, setErro] = useState('')

  const [linkCopiado, setLinkCopiado] = useState(false)

  function copiarLinkPersonalizado() {
    if (!empresa?.slug) return
    const link = `${window.location.origin}/agendar/${empresa.slug}`
    navigator.clipboard.writeText(link)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }
  
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
      .select('id, nome, telefone, tipo_operacao, periodo, status, cnpj, email_comercial, cidade, estado, qtd_veiculos, descricao, chave_pix, tipo_chave_pix, instagram, whatsapp_comercial, cor_destaque, logo_url, trial_fim, slug, transfer_numero_inicio, mensagem_confirmacao, mensagem_confirmacao_transfer, endereco_rua, endereco_numero, endereco_bairro, endereco_cep, inscricao_estadual, site, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular_nome, banco_titular_documento, minutos_antes_lembrete, horas_apos_atendimento_cobranca')
      .eq('id', gestor.empresa_id)
      .single()

    if (emp) setEmpresa(emp)
    setLoading(false)
  }

  async function uploadLogo(file: File | null) {
    if (!file || !empresa) return
    setLogoErro('')
    // Validacao rapida: tamanho ate 3MB, tipo imagem comum
    if (file.size > 3 * 1024 * 1024) {
      setLogoErro('Imagem grande demais. Máximo 3 MB.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLogoErro('Formato não suportado. Use PNG, JPG, WEBP ou SVG.')
      return
    }
    setUploadingLogo(true)
    try {
      // Nome unico por empresa (timestamp evita cache do CDN quando trocar).
      // Ficam varios arquivos historicos no bucket, mas são poucos KB — se
      // no futuro incomodar, dá pra limpar via cron.
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${empresa.id}/${Date.now()}.${ext}`
      const { error: errUp } = await supabase.storage
        .from('logos-empresas')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (errUp) throw errUp
      const { data } = supabase.storage.from('logos-empresas').getPublicUrl(path)
      const url = data.publicUrl
      setEmpresa(emp => emp ? { ...emp, logo_url: url } : emp)
    } catch (err: any) {
      console.error('[uploadLogo]', err)
      setLogoErro('Erro ao enviar a imagem. Tente novamente.')
    } finally {
      setUploadingLogo(false)
    }
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
        transfer_numero_inicio: empresa.transfer_numero_inicio || 1,
        mensagem_confirmacao: empresa.mensagem_confirmacao?.trim() || null,
        mensagem_confirmacao_transfer: empresa.mensagem_confirmacao_transfer?.trim() || null,
        endereco_rua:           empresa.endereco_rua?.trim()           || null,
        endereco_numero:        empresa.endereco_numero?.trim()        || null,
        endereco_bairro:        empresa.endereco_bairro?.trim()        || null,
        endereco_cep:           empresa.endereco_cep?.trim()           || null,
        inscricao_estadual:     empresa.inscricao_estadual?.trim()     || null,
        site:                   empresa.site?.trim()                   || null,
        banco_nome:             empresa.banco_nome?.trim()             || null,
        banco_agencia:          empresa.banco_agencia?.trim()          || null,
        banco_conta:            empresa.banco_conta?.trim()            || null,
        banco_tipo_conta:       empresa.banco_tipo_conta               || null,
        banco_titular_nome:     empresa.banco_titular_nome?.trim()     || null,
        banco_titular_documento: empresa.banco_titular_documento?.trim() || null,
        minutos_antes_lembrete: empresa.minutos_antes_lembrete ?? 60,
        horas_apos_atendimento_cobranca: empresa.horas_apos_atendimento_cobranca ?? 24,
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
                  {empresa?.status === 'ativo' && empresa?.periodo
                    ? (PERIODO_LABEL[empresa.periodo] || empresa.periodo)
                    : 'Nenhum — em avaliação'}
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

        <Secao titulo="📍 Endereço fiscal (opcional)">
          <p className="text-xs text-gray-400 mb-3">
            Usado no cabeçalho dos vouchers e recibos enviados aos clientes.
          </p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <Campo label="Rua / Logradouro">
                <input
                  value={empresa?.endereco_rua || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, endereco_rua: e.target.value } : emp)}
                  placeholder="Ex: Rua Gumercindo de Paula"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Número">
                <input
                  value={empresa?.endereco_numero || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, endereco_numero: e.target.value } : emp)}
                  placeholder="203"
                  className="campo-input"
                />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Bairro">
                <input
                  value={empresa?.endereco_bairro || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, endereco_bairro: e.target.value } : emp)}
                  placeholder="Ex: Jardim Monte Alegre"
                  className="campo-input"
                />
              </Campo>
              <Campo label="CEP">
                <input
                  value={empresa?.endereco_cep || ''}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                    const mask = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v
                    setEmpresa(emp => emp ? { ...emp, endereco_cep: mask } : emp)
                  }}
                  placeholder="00000-000"
                  className="campo-input"
                />
              </Campo>
            </div>
            <Campo label="Inscrição Estadual (opcional)">
              <input
                value={empresa?.inscricao_estadual || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, inscricao_estadual: e.target.value } : emp)}
                placeholder="Ex: 123.456.789.000 ou Isento"
                className="campo-input"
              />
            </Campo>
            <Campo label="Site (opcional)">
              <input
                value={empresa?.site || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, site: e.target.value } : emp)}
                placeholder="www.suaempresa.com.br"
                className="campo-input"
              />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="🏦 Dados bancários (opcional)">
          <p className="text-xs text-gray-400 mb-3">
            Aparecem no rodapé dos vouchers/recibos pro cliente pagar por
            transferência ou Pix. A chave Pix e o tipo de chave ficam na
            seção "Personalização" abaixo.
          </p>
          <div className="flex flex-col gap-3">
            <Campo label="Banco">
              <input
                value={empresa?.banco_nome || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, banco_nome: e.target.value } : emp)}
                placeholder="Ex: C6, Itaú, Bradesco"
                className="campo-input"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Agência">
                <input
                  value={empresa?.banco_agencia || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, banco_agencia: e.target.value } : emp)}
                  placeholder="0001"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Conta">
                <input
                  value={empresa?.banco_conta || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, banco_conta: e.target.value } : emp)}
                  placeholder="12345-6"
                  className="campo-input"
                />
              </Campo>
            </div>
            <Campo label="Tipo de conta">
              <select
                value={empresa?.banco_tipo_conta || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, banco_tipo_conta: e.target.value } : emp)}
                className="campo-input"
              >
                <option value="">Selecione...</option>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="pagamento">Pagamento</option>
              </select>
            </Campo>
            <Campo label="Titular da conta">
              <input
                value={empresa?.banco_titular_nome || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, banco_titular_nome: e.target.value } : emp)}
                placeholder="Nome como consta no banco"
                className="campo-input"
              />
            </Campo>
            <Campo label="CPF/CNPJ do titular">
              <input
                value={empresa?.banco_titular_documento || ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, banco_titular_documento: e.target.value } : emp)}
                placeholder="XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX"
                className="campo-input"
              />
            </Campo>
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
            <Campo label="Logo da empresa">
              {empresa?.logo_url && (
                <img
                  src={empresa.logo_url}
                  alt="Logo"
                  className="mb-2 h-16 object-contain rounded border border-gray-200 bg-white p-1"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex flex-col gap-2">
                <label className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed cursor-pointer text-sm text-center font-medium transition-colors"
                  style={{
                    borderColor: uploadingLogo ? '#9FE1CB' : '#e5e7eb',
                    color: uploadingLogo ? '#0F6E56' : '#374151',
                    background: uploadingLogo ? '#F0FDF8' : '#fff',
                  }}>
                  {uploadingLogo ? '⏳ Enviando...' : '📷 Escolher imagem do celular'}
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={e => uploadLogo(e.target.files?.[0] || null)}
                  />
                </label>
                {logoErro && (
                  <p className="text-xs text-red-600">{logoErro}</p>
                )}
                {empresa?.logo_url && (
                  <button type="button" onClick={() => setEmpresa(emp => emp ? { ...emp, logo_url: null } : emp)}
                    className="text-xs text-red-500 self-start">
                    🗑️ Remover logo
                  </button>
                )}
              </div>
              <details className="mt-3">
                <summary className="text-xs text-gray-400 cursor-pointer">Já tem um link da logo? Colar manualmente</summary>
                <input
                  value={empresa?.logo_url || ''}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, logo_url: e.target.value } : emp)}
                  placeholder="https://..."
                  className="campo-input mt-2"
                />
              </details>
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1.5">
                  <p className="text-xs break-all" style={{ color: '#6B7280' }}>
                    Seu link será:{' '}
                    <span className="font-medium" style={{ color: '#0F6E56' }}>
                      {window.location.origin}/agendar/{empresa.slug}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={copiarLinkPersonalizado}
                    className="flex-shrink-0 self-start sm:self-auto px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                    style={{ background: linkCopiado ? '#E1F5EE' : '#0F6E56', color: linkCopiado ? '#0F6E56' : '#fff' }}
                  >
                    {linkCopiado ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                </div>
              )}
              {!empresa?.slug && (
                <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>
                  Seu link será: {window.location.origin}/agendar/[slug]
                </p>
              )}
            </Campo>
            {(empresa?.tipo_operacao === 'transfer' || empresa?.tipo_operacao === 'turismo') && (
              <Campo label="Número inicial do transfer">
                <input
                  type="number"
                  min="1"
                  value={empresa?.transfer_numero_inicio ?? 1}
                  onChange={e => setEmpresa(emp => emp ? { ...emp, transfer_numero_inicio: parseInt(e.target.value) || 1 } : emp)}
                  className="campo-input"
                />
                <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                  ℹ️ Número a partir do qual sua sequência de transfers começa. Os novos agendamentos serão numerados automaticamente a partir daqui.
                </p>
              </Campo>
            )}
          </div>
        </Secao>

        <Secao titulo="💬 Mensagens de confirmação (WhatsApp)">
          <div className="flex flex-col gap-4">
            <Campo label="Agendamento de passageiros (rota fixa)">
              <textarea
                value={empresa?.mensagem_confirmacao ?? ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, mensagem_confirmacao: e.target.value } : emp)}
                placeholder={'Olá {nome}! 👋\n\nConfirmando sua viagem:\n📍 {origem} → {destino}\n📅 {data} - {turno}\n💰 R$ {valor}\n\nTudo certo? ✅'}
                rows={6}
                className="campo-input"
                style={{ resize: 'vertical' }}
              />
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                ℹ️ Deixe em branco para usar a mensagem padrão. Variáveis: <b>{'{nome}'}</b>, <b>{'{origem}'}</b>, <b>{'{destino}'}</b>, <b>{'{data}'}</b>, <b>{'{turno}'}</b>, <b>{'{valor}'}</b>.
              </p>
            </Campo>

            <Campo label="Fretamentos / Transfer">
              <textarea
                value={empresa?.mensagem_confirmacao_transfer ?? ''}
                onChange={e => setEmpresa(emp => emp ? { ...emp, mensagem_confirmacao_transfer: e.target.value } : emp)}
                placeholder={'Olá {nome}, tudo bem!\n\nConfirmamos o seu transfer:\n\n📅 Data/Hora: {data} às {hora} ({dia})\n📍 Origem: {origem}\n📍 Destino: {destino}'}
                rows={6}
                className="campo-input"
                style={{ resize: 'vertical' }}
              />
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                ℹ️ Deixe em branco para usar a mensagem padrão. Variáveis: <b>{'{nome}'}</b>, <b>{'{data}'}</b>, <b>{'{hora}'}</b>, <b>{'{dia}'}</b>, <b>{'{origem}'}</b>, <b>{'{destino}'}</b>. Informações de voo, retorno e observações são adicionadas automaticamente quando existirem.
              </p>
            </Campo>
          </div>
        </Secao>

        <Secao titulo="🔔 Lembrete antes do atendimento">
          <Campo label="Avisar o motorista com quanta antecedência?">
            <select
              value={String(empresa?.minutos_antes_lembrete ?? 60)}
              onChange={e => setEmpresa(emp => emp ? { ...emp, minutos_antes_lembrete: parseInt(e.target.value) } : emp)}
              className="campo-input"
            >
              <option value="0">Não enviar lembrete</option>
              <option value="30">30 minutos antes</option>
              <option value="60">1 hora antes</option>
              <option value="90">1h30 antes</option>
              <option value="120">2 horas antes</option>
              <option value="180">3 horas antes</option>
              <option value="240">4 horas antes</option>
            </select>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
              ℹ️ O motorista atribuído recebe uma notificação nesse intervalo antes de
              cada atendimento. Escolha considerando o deslocamento típico da sua região.
              Se o horário do atendimento mudar, o lembrete é reajustado automaticamente.
            </p>
          </Campo>
        </Secao>

        <Secao titulo="💰 Alerta de pagamento pendente (Pix/Dinheiro/Cartão)">
          <Campo label="Avisar quantas horas depois do atendimento?">
            <select
              value={String(empresa?.horas_apos_atendimento_cobranca ?? 24)}
              onChange={e => setEmpresa(emp => emp ? { ...emp, horas_apos_atendimento_cobranca: parseInt(e.target.value) } : emp)}
              className="campo-input"
            >
              <option value="0">Não enviar alerta</option>
              <option value="12">12 horas depois</option>
              <option value="24">24 horas depois</option>
              <option value="48">48 horas depois</option>
              <option value="72">72 horas depois</option>
            </select>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
              ℹ️ Pagamentos em Pix, Dinheiro ou Cartão não têm data de vencimento (são
              esperados no dia do atendimento). Se continuarem sem confirmação de
              recebimento depois desse prazo, você recebe um aviso — útil pra pegar
              casos em que o motorista ainda não repassou ou o cliente não pagou.
              Avisa uma única vez por atendimento. Faturado continua com o alerta
              de vencimento próprio, configurado por atendimento.
            </p>
          </Campo>
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
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
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
